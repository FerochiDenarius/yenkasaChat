const mongoose = require("mongoose");
const Community = require("../models/community.model");
const Notification = require("../models/notifications.model");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const UserPrivacy = require("../models/userPrivacy.model");
const { sendNotification } = require("./notification.service");
const {
  NOTIFICATION_EVENT_TYPES,
  emitNotificationOperationalEvent
} = require("./notificationOperationalEvents.service");

const COMMUNITY_POST_TYPE = NOTIFICATION_EVENT_TYPES.COMMUNITY_POST_CREATED;
const BATCH_SIZE = 25;
const NOTIFICATION_COOLDOWN_MS = 2 * 60 * 1000;

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function normalizeId(value) {
  return value?.toString?.() || "";
}

function getCommunityName(community) {
  return community?.displayName || community?.name || "your community";
}

function getPostThumbnail(post) {
  if (Array.isArray(post?.imageUrls) && post.imageUrls.length > 0) return post.imageUrls[0];
  return post?.imageUrl || post?.thumbnail || post?.videoThumbnail || post?.videoUrl || "";
}

function buildTargetUrl(postId, communityId) {
  return `/communities?communityId=${communityId}&postId=${postId}`;
}

async function getSkippedRecipientIds({ creatorId, communityId }) {
  const [creatorPrivacy, privacyDocs] = await Promise.all([
    UserPrivacy.findOne({ userId: creatorId }).select("blockedUsers").lean(),
    UserPrivacy.find({
      $or: [
        { blockedUsers: creatorId },
        { blockedCommunities: communityId }
      ]
    }).select("userId blockedUsers blockedCommunities").lean()
  ]);

  const skipped = new Set((creatorPrivacy?.blockedUsers || []).map(normalizeId));

  privacyDocs.forEach((privacy) => {
    const userId = normalizeId(privacy.userId);
    const blocksCreator = (privacy.blockedUsers || []).some((id) => normalizeId(id) === normalizeId(creatorId));
    const mutedCommunity = (privacy.blockedCommunities || []).some((id) => normalizeId(id) === normalizeId(communityId));
    if (userId && (blocksCreator || mutedCommunity)) {
      skipped.add(userId);
    }
  });

  return skipped;
}

async function fetchEligibleRecipients({ community, creatorId }) {
  const communityId = community._id;
  const now = new Date();
  const skippedIds = await getSkippedRecipientIds({ creatorId, communityId });
  const memberIds = (community.members || []).map(toObjectId).filter(Boolean);

  const recipients = await User.find({
    _id: {
      $ne: creatorId,
      ...(skippedIds.size ? { $nin: [...skippedIds].map(toObjectId).filter(Boolean) } : {})
    },
    $and: [
      {
        $or: [
          { joinedCommunities: communityId },
          { community: communityId },
          ...(memberIds.length ? [{ _id: { $in: memberIds } }] : [])
        ]
      },
      {
        $or: [
          { suspendedUntil: { $exists: false } },
          { suspendedUntil: null },
          { suspendedUntil: { $lte: now } }
        ]
      }
    ]
  }).select("_id username playerId notificationPreferences suspendedUntil").lean();

  return recipients;
}

async function alreadyNotifiedRecently({ senderId, receiverId, communityId }) {
  const since = new Date(Date.now() - NOTIFICATION_COOLDOWN_MS);
  return Notification.exists({
    type: COMMUNITY_POST_TYPE,
    senderId,
    receiverId,
    targetUrl: new RegExp(`communityId=${communityId}`),
    createdAt: { $gte: since }
  });
}

function buildCommunityPostNotificationData({ post, community, creator, recipient }) {
  const postId = normalizeId(post._id);
  const communityId = normalizeId(community._id);
  const communityName = getCommunityName(community);
  const username = creator.username || "Someone";
  const thumbnail = getPostThumbnail(post);
  const targetUrl = buildTargetUrl(postId, communityId);
  const title = `New post in ${communityName}`;
  const message = `${username} shared a new post.`;

  return {
    type: COMMUNITY_POST_TYPE,
    senderId: creator._id,
    receiverId: recipient._id,
    activityId: postId,
    targetType: "community",
    targetId: communityId,
    targetUrl,
    message,
    emitSocket: true,
    push: true,
    pushTitle: title,
    pushBody: message,
    pushData: {
      type: COMMUNITY_POST_TYPE,
      notificationType: COMMUNITY_POST_TYPE,
      activityId: postId,
      postId,
      targetType: "community",
      targetId: communityId,
      targetUrl,
      communityId,
      communityName,
      authorId: normalizeId(creator._id),
      authorName: username,
      timestamp: new Date().toISOString(),
      username,
      thumbnail,
      mediaPreview: thumbnail
    },
    pushCollapseId: `${COMMUNITY_POST_TYPE}_${communityId}_${postId}_${recipient._id}`,
    pushAndroidGroup: `community_${communityId}`,
    pushAndroidGroupMessage: `New posts in ${communityName}`,
    pushTtl: 60 * 60 * 24,
    pushPriority: 10
  };
}

async function notifyRecipient({ post, community, creator, recipient }) {
  const communityId = normalizeId(community._id);

  if (await alreadyNotifiedRecently({
    senderId: creator._id,
    receiverId: recipient._id,
    communityId
  })) {
    return { status: "skipped_recent" };
  }

  const delivered = await sendNotification(
    buildCommunityPostNotificationData({ post, community, creator, recipient })
  );

  return { status: delivered ? "sent" : "skipped" };
}

async function dispatchCommunityPostNotifications(postId) {
  const post = await Post.findById(postId)
    .populate("userId", "username profileImage")
    .lean();

  if (!post || post.status !== "approved" || !post.communityId || !post.userId) {
    return;
  }

  const community = await Community.findById(post.communityId)
    .select("_id name displayName members icon imageUrl")
    .lean();

  if (!community) return;

  const creator = post.userId;
  const recipients = await fetchEligibleRecipients({
    community,
    creatorId: creator._id
  });
  const timestamp = new Date().toISOString();

  emitNotificationOperationalEvent(NOTIFICATION_EVENT_TYPES.COMMUNITY_POST_CREATED, {
    communityId: normalizeId(community._id),
    communityName: getCommunityName(community),
    postId: normalizeId(post._id),
    authorId: normalizeId(creator._id),
    authorName: creator.username || "Someone",
    userId: normalizeId(creator._id),
    timestamp
  });

  const stats = {
    postId: normalizeId(post._id),
    communityId: normalizeId(community._id),
    totalEligible: recipients.length,
    sent: 0,
    skipped: 0,
    skippedRecent: 0,
    failed: 0
  };

  for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
    const batch = recipients.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((recipient) => notifyRecipient({ post, community, creator, recipient }))
    );

    results.forEach((result) => {
      if (result.status === "rejected") {
        stats.failed += 1;
        return;
      }
      if (result.value?.status === "sent") stats.sent += 1;
      else if (result.value?.status === "skipped_recent") stats.skippedRecent += 1;
      else stats.skipped += 1;
    });
  }

  console.log("[CommunityPostNotifications] completed", stats);
  return stats;
}

function queueCommunityPostNotifications({ postId }) {
  if (!postId) return;

  setImmediate(() => {
    dispatchCommunityPostNotifications(postId).catch((error) => {
      console.error("[CommunityPostNotifications] failed", {
        postId: normalizeId(postId),
        error: error.message
      });
    });
  });
}

module.exports = {
  COMMUNITY_POST_TYPE,
  buildCommunityPostNotificationData,
  queueCommunityPostNotifications,
  dispatchCommunityPostNotifications
};
