const mongoose = require("mongoose");
const UserPrivacy = require("../models/userPrivacy.model");
const User = require("../models/user.model");

const VALID_PRIVACY_LEVELS = new Set(["everyone", "community_members", "requires_approval", "nobody"]);

function normalizeId(value) {
  if (!value) return "";
  if (value._id) return value._id.toString();
  return value.toString();
}

function hasId(list, id) {
  const target = normalizeId(id);
  return Array.isArray(list) && list.some(item => normalizeId(item) === target);
}

async function ensurePrivacy(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;

  return UserPrivacy.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true }
  );
}

async function getPrivacy(userId) {
  return ensurePrivacy(userId);
}

async function getPrivacyPair(userA, userB) {
  return Promise.all([getPrivacy(userA), getPrivacy(userB)]);
}

async function areUsersBlocked(userA, userB) {
  if (!userA || !userB) return false;
  const [privacyA, privacyB] = await getPrivacyPair(userA, userB);
  return hasId(privacyA?.blockedUsers, userB) || hasId(privacyB?.blockedUsers, userA);
}

async function hasUserBlocked(blockerId, blockedId) {
  if (!blockerId || !blockedId) return false;
  const privacy = await getPrivacy(blockerId);
  return hasId(privacy?.blockedUsers, blockedId);
}

async function getBlockedRelationshipUserIds(viewerId) {
  const viewer = normalizeId(viewerId);
  if (!viewer) return [];

  const myPrivacy = await getPrivacy(viewer);
  const iBlocked = myPrivacy?.blockedUsers?.map(id => normalizeId(id)).filter(Boolean) || [];

  const blockedMeDocs = await UserPrivacy.find({ blockedUsers: viewer }).select("userId").lean();
  const blockedMe = blockedMeDocs.map(doc => normalizeId(doc.userId)).filter(Boolean);

  return [...new Set([...iBlocked, ...blockedMe])];
}

function communityIdsForUser(user) {
  if (!user) return [];

  const ids = [];
  if (user.community) ids.push(normalizeId(user.community));
  if (Array.isArray(user.joinedCommunities)) {
    user.joinedCommunities.forEach(id => ids.push(normalizeId(id)));
  }

  return [...new Set(ids.filter(Boolean))];
}

async function shareCommunity(userA, userB) {
  const [a, b] = await Promise.all([
    User.findById(userA).select("community joinedCommunities").lean(),
    User.findById(userB).select("community joinedCommunities").lean()
  ]);

  const aCommunities = new Set(communityIdsForUser(a));
  return communityIdsForUser(b).some(id => aCommunities.has(id));
}

async function canMessageUser(senderId, receiverId) {
  const sender = normalizeId(senderId);
  const receiver = normalizeId(receiverId);

  if (!sender || !receiver) {
    return { allowed: false, reason: "invalid_user", message: "Invalid message participant" };
  }

  if (sender === receiver) {
    return { allowed: false, reason: "self", message: "You cannot message yourself" };
  }

  const [senderPrivacy, receiverPrivacy] = await getPrivacyPair(sender, receiver);

  if (hasId(senderPrivacy?.blockedUsers, receiver)) {
    return {
      allowed: false,
      reason: "you_blocked_user",
      message: "You have blocked this user. Unblock them before messaging."
    };
  }

  if (hasId(receiverPrivacy?.blockedUsers, sender)) {
    return {
      allowed: false,
      reason: "blocked_by_user",
      message: "You have been blocked by this user."
    };
  }

  const privacyLevel = VALID_PRIVACY_LEVELS.has(receiverPrivacy?.privacyLevel)
    ? receiverPrivacy.privacyLevel
    : "everyone";

  if (privacyLevel === "nobody") {
    return { allowed: false, reason: "not_accepting", message: "This user is not accepting messages" };
  }

  if (privacyLevel === "community_members" && !hasId(receiverPrivacy?.approvedMessageUsers, sender)) {
    const isCommunityMember = await shareCommunity(sender, receiver);
    if (!isCommunityMember) {
      return {
        allowed: false,
        reason: "not_community_member",
        message: "Only people who share a community with this user can message them"
      };
    }
  }

  if (privacyLevel === "requires_approval" && !hasId(receiverPrivacy?.approvedMessageUsers, sender)) {
    return { allowed: false, reason: "requires_approval", message: "This user requires message approval" };
  }

  return { allowed: true, reason: "allowed", message: "Allowed" };
}

async function approveMessageUser(ownerId, approvedUserId) {
  return UserPrivacy.findOneAndUpdate(
    { userId: ownerId },
    {
      $setOnInsert: { userId: ownerId },
      $addToSet: { approvedMessageUsers: approvedUserId }
    },
    { new: true, upsert: true }
  );
}

module.exports = {
  VALID_PRIVACY_LEVELS,
  approveMessageUser,
  areUsersBlocked,
  canMessageUser,
  ensurePrivacy,
  getBlockedRelationshipUserIds,
  hasId,
  hasUserBlocked
};
