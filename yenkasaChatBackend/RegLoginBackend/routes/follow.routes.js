const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const User = require('../models/user.model');
const Follow = require('../models/follow.model');
const UserPrivacy = require("../models/userPrivacy.model");

const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');
const { sendNotification } = require('../services/notification.service');

const REWARD_FOLLOW = 10;  // follower gets 10 coins
const REWARD_FOLLOW_RECEIVED = 5; // followed user gets 5 coins

/* ---------------------------------------------------
 * Block check helper
 * --------------------------------------------------- */
async function isBlocked(userA, userB) {
  const [privacyA, privacyB] = await Promise.all([
    UserPrivacy.findOne({ userId: userA }).lean(),
    UserPrivacy.findOne({ userId: userB }).lean()
  ]);

  return (
    privacyA?.blockedUsers?.includes(userB) ||
    privacyB?.blockedUsers?.includes(userA)
  );
}

/* ---------------------------------------------------
 * FOLLOW A USER
 * --------------------------------------------------- */
router.post('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const io = req.app.get("io");
    const followerId = req.user.id;
    const targetId = req.params.userId;

    if (followerId === targetId)
      return res.status(400).json({ error: "You cannot follow yourself" });

    if (await isBlocked(followerId, targetId))
      return res.status(403).json({ error: "Action blocked by privacy settings" });

    const followerUser = await User.findById(followerId);
    const targetUser = await User.findById(targetId);

    if (!targetUser)
      return res.status(404).json({ error: "User not found" });

    // activityId
    const activityId = `follow_${followerId}_${targetId}_${uuidv4()}`;

    // CREATE OR UPDATE FOLLOW DOC
    const followDoc = await Follow.findOneAndUpdate(
      { follower: followerId, following: targetId },
      { status: "active", followedAt: new Date(), activityId },
      { upsert: true, new: true }
    );

    // UPDATE FOLLOW COUNTS BASED ON FOLLOW COLLECTION
    const followersCount = await Follow.countDocuments({
      following: targetId,
      status: "active"
    });

    const followingCount = await Follow.countDocuments({
      follower: followerId,
      status: "active"
    });

    await User.findByIdAndUpdate(targetId, { followersCount });
    await User.findByIdAndUpdate(followerId, { followingCount });

    /* ---------------------------------------------------
     * REWARD FOLLOWER
     * --------------------------------------------------- */
    const rewardTx = await rewardService.reward(followerId, REWARD_FOLLOW, {
      type: "REWARD_FOLLOW",
      description: `Followed ${targetUser.username}`,
      relatedUserId: targetId,
      activityId
    });

    /* ---------------------------------------------------
 * REWARD USER WHO IS FOLLOWED
 * --------------------------------------------------- */
const rewardReceivedTx = await rewardService.reward(targetId, REWARD_FOLLOW_RECEIVED, {
  type: "REWARD_FOLLOW_RECEIVED",
  description: `${followerUser.username} followed you`,
  relatedUserId: followerId,
  activityId: `${activityId}_received`
});


    /* ---------------------------------------------------
     * SEND NOTIFICATION (if allowed)
     * --------------------------------------------------- */
    if (!(await isBlocked(targetId, followerId))) {
      await sendNotification({
        type: "follow",
        senderId: followerId,
        receiverId: targetId,
        activityId,
        message: `${followerUser.username} started following you.`
      });
    }

    /* ---------------------------------------------------
     * SOCKET UPDATE
     * --------------------------------------------------- */
    if (io) {
      io.emit("feedUpdate", {
        type: "newFollow",
        followerId,
        followedId: targetId,
        reward: rewardTx,
        timestamp: new Date(),
      });
    }

    return res.json({
      success: true,
      message: `You are now following ${targetUser.username}`,
      isFollowing: true,
      followersCount,
      followingCount,
      reward: rewardTx,
      activityId,
      timestamp: new Date()
    });

  } catch (err) {
    console.error("❌ Follow error:", err);
    return res.status(500).json({ error: "Failed to follow user" });
  }
});


/* ---------------------------------------------------
 * UNFOLLOW A USER
 * --------------------------------------------------- */
router.post('/:userId/unfollow', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const targetId = req.params.userId;

    if (followerId === targetId)
      return res.status(400).json({ error: "You cannot unfollow yourself" });

    const existing = await Follow.findOne({ follower: followerId, following: targetId });

    if (!existing || existing.status === "unfollowed")
      return res.status(400).json({ error: "You are not following this user" });

    // Mark as unfollowed
    await Follow.findOneAndUpdate(
      { follower: followerId, following: targetId },
      { status: "unfollowed", unfollowedAt: new Date() }
    );

    // Update counters
    const followersCount = await Follow.countDocuments({
      following: targetId,
      status: "active"
    });

    const followingCount = await Follow.countDocuments({
      follower: followerId,
      status: "active"
    });

    await User.findByIdAndUpdate(targetId, { followersCount });
    await User.findByIdAndUpdate(followerId, { followingCount });

    return res.json({
      success: true,
      message: `You unfollowed ${targetId}`,
      isFollowing: false,
      followersCount,
      followingCount
    });

  } catch (err) {
    console.error("❌ Unfollow error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


/* ---------------------------------------------------
 * GET USER'S FOLLOWING LIST
 * --------------------------------------------------- */
router.get('/:userId/following', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { page = 1, limit = 50 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const followingDocs = await Follow.find({
      follower: userId,
      status: "active"
    })
      .populate("following", "username profileImage bio verified followersCount followingCount")
      .sort({ followedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalFollowing = await Follow.countDocuments({
      follower: userId,
      status: "active"
    });

    return res.json({
      following: followingDocs.map(f => f.following),
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalFollowing / limit),
        totalFollowing,
        hasMore: skip + followingDocs.length < totalFollowing
      }
    });

  } catch (err) {
    console.error("❌ fetch following error:", err);
    return res.status(500).json({ error: "Failed to fetch following" });
  }
});


/* ---------------------------------------------------
 * FOLLOW STATS
 * --------------------------------------------------- */
router.get('/:userId/follow-stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const viewerId = req.user.id;

    const user = await User.findById(userId).select(
      "followersCount followingCount createdAt updatedAt"
    );

    const isFollowedByViewer = await Follow.findOne({
      follower: viewerId,
      following: userId,
      status: "active"
    });

    return res.json({
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowedByViewer: !!isFollowedByViewer,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

  } catch (err) {
    console.error("❌ Follow stats error:", err);
    return res.status(500).json({ error: "Failed to fetch follow stats" });
  }
});

module.exports = router;
