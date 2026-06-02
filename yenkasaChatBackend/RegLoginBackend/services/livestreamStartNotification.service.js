const mongoose = require("mongoose");

const Community = require("../models/community.model");
const Follow = require("../models/follow.model");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const UserPrivacy = require("../models/userPrivacy.model");
const { sendNotification } = require("./notification.service");
const {
  NOTIFICATION_EVENT_TYPES,
  emitNotificationOperationalEvent
} = require("./notificationOperationalEvents.service");

const STREAM_STARTED_TYPE = NOTIFICATION_EVENT_TYPES.STREAM_STARTED;
const BATCH_SIZE = 25;

function normalizeId(value) {
  return value?.toString?.() || "";
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function communityName(community, fallback = "") {
  return community?.displayName || community?.name || fallback || "";
}

async function resolveCommunity(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (mongoose.Types.ObjectId.isValid(raw)) {
    const community = await Community.findById(raw).select("_id name displayName members").lean();
    if (community) return community;
  }

  return Community.findOne({
    $or: [
      { name: new RegExp(`^${escapeRegex(raw)}$`, "i") },
      { displayName: new RegExp(`^${escapeRegex(raw)}$`, "i") }
    ]
  }).select("_id name displayName members").lean();
}

async function skippedRecipientIds(hostId, communityId = null) {
  const [hostPrivacy, privacyDocs] = await Promise.all([
    UserPrivacy.findOne({ userId: hostId }).select("blockedUsers").lean(),
    UserPrivacy.find({
      $or: [
        { blockedUsers: hostId },
        ...(communityId ? [{ blockedCommunities: communityId }] : [])
      ]
    }).select("userId blockedUsers blockedCommunities").lean()
  ]);

  const skipped = new Set((hostPrivacy?.blockedUsers || []).map(normalizeId));
  privacyDocs.forEach((privacy) => {
    const userId = normalizeId(privacy.userId);
    const blocksHost = (privacy.blockedUsers || []).some((id) => normalizeId(id) === normalizeId(hostId));
    const mutedCommunity = communityId
      ? (privacy.blockedCommunities || []).some((id) => normalizeId(id) === normalizeId(communityId))
      : false;
    if (userId && (blocksHost || mutedCommunity)) skipped.add(userId);
  });

  return skipped;
}

async function fetchCommunityRecipients({ community, hostId }) {
  const now = new Date();
  const communityId = community._id;
  const skipped = await skippedRecipientIds(hostId, communityId);
  const memberIds = (community.members || []).map(toObjectId).filter(Boolean);

  return User.find({
    _id: {
      $ne: hostId,
      ...(skipped.size ? { $nin: [...skipped].map(toObjectId).filter(Boolean) } : {})
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
}

async function fetchFollowerRecipients({ hostId }) {
  const now = new Date();
  const skipped = await skippedRecipientIds(hostId);
  const followerDocs = await Follow.find({ following: hostId, status: "active" }).select("follower").lean();
  const followerIds = followerDocs.map((doc) => toObjectId(doc.follower)).filter(Boolean);
  if (!followerIds.length) return [];

  return User.find({
    _id: {
      $in: followerIds,
      $ne: hostId,
      ...(skipped.size ? { $nin: [...skipped].map(toObjectId).filter(Boolean) } : {})
    },
    $or: [
      { suspendedUntil: { $exists: false } },
      { suspendedUntil: null },
      { suspendedUntil: { $lte: now } }
    ]
  }).select("_id username playerId notificationPreferences suspendedUntil").lean();
}

async function streamStartAlreadySent(streamId, receiverId) {
  return Notification.exists({
    type: STREAM_STARTED_TYPE,
    receiverId,
    activityId: normalizeId(streamId)
  });
}

function buildLivestreamStartNotificationData({ stream, host, recipient, community }) {
  const streamId = normalizeId(stream._id);
  const hostName = host.username || stream.hostUsername || "Someone";
  const resolvedCommunityName = communityName(community, stream.community);
  const targetUrl = `/live/${streamId}`;
  const communityId = normalizeId(community?._id);
  const inCommunity = Boolean(communityId);
  const title = inCommunity
    ? `A livestream has started in ${resolvedCommunityName}.`
    : `${hostName} is now live.`;
  const message = inCommunity ? "Watch now." : "Join livestream now.";

  return {
    type: STREAM_STARTED_TYPE,
    senderId: host._id,
    receiverId: recipient._id,
    activityId: streamId,
    targetType: "live",
    targetId: streamId,
    targetUrl,
    message: `${title} ${message}`,
    emitSocket: true,
    push: true,
    pushTitle: title,
    pushBody: message,
    pushData: {
      type: STREAM_STARTED_TYPE,
      notificationType: STREAM_STARTED_TYPE,
      streamId,
      hostId: normalizeId(host._id),
      hostName,
      communityId,
      communityName: resolvedCommunityName,
      title: stream.title || "",
      timestamp: new Date().toISOString(),
      targetType: "live",
      targetId: streamId,
      targetUrl
    },
    pushCollapseId: `${STREAM_STARTED_TYPE}_${streamId}_${recipient._id}`,
    pushAndroidGroup: inCommunity ? `community_${communityId}` : `creator_${host._id}`,
    pushAndroidGroupMessage: inCommunity
      ? `Livestreams in ${resolvedCommunityName}`
      : `${hostName} livestreams`,
    pushTtl: 60 * 60,
    pushPriority: 10
  };
}

async function notifyRecipient({ stream, host, recipient, community }) {
  if (await streamStartAlreadySent(stream._id, recipient._id)) {
    return { status: "skipped_recent" };
  }

  const delivered = await sendNotification(
    buildLivestreamStartNotificationData({ stream, host, recipient, community })
  );

  return { status: delivered ? "sent" : "skipped" };
}

async function dispatchLivestreamStartNotifications(streamId) {
  const stream = await require("../models/LiveStream").findById(streamId).lean();
  if (!stream || !stream.hostId || !stream.isLive || stream.lifecycleStatus !== "live") return null;

  const host = await User.findById(stream.hostId).select("_id username profileImage").lean();
  if (!host) return null;

  const community = await resolveCommunity(stream.community);
  const recipients = community
    ? await fetchCommunityRecipients({ community, hostId: host._id })
    : await fetchFollowerRecipients({ hostId: host._id });

  const payload = {
    streamId: normalizeId(stream._id),
    hostId: normalizeId(host._id),
    hostName: host.username || stream.hostUsername || "",
    communityId: normalizeId(community?._id),
    communityName: communityName(community, stream.community),
    title: stream.title || "",
    userId: normalizeId(host._id),
    timestamp: new Date().toISOString()
  };

  emitNotificationOperationalEvent(NOTIFICATION_EVENT_TYPES.STREAM_STARTED, payload);

  const stats = {
    streamId: payload.streamId,
    mode: community ? "community" : "followers",
    totalEligible: recipients.length,
    sent: 0,
    skipped: 0,
    skippedRecent: 0,
    failed: 0
  };

  for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
    const batch = recipients.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((recipient) => notifyRecipient({ stream, host, recipient, community }))
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

  console.log("[LivestreamStartNotifications] completed", stats);
  return stats;
}

function queueLivestreamStartNotifications({ streamId }) {
  if (!streamId) return;
  setImmediate(() => {
    dispatchLivestreamStartNotifications(streamId).catch((error) => {
      console.error("[LivestreamStartNotifications] failed", {
        streamId: normalizeId(streamId),
        error: error.message
      });
    });
  });
}

module.exports = {
  STREAM_STARTED_TYPE,
  buildLivestreamStartNotificationData,
  dispatchLivestreamStartNotifications,
  queueLivestreamStartNotifications
};
