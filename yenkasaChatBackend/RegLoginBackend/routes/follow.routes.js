const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');
const { sendNotification } = require('../services/notification.service');
const UserPrivacy = require("../models/userPrivacy.model");

const REWARD_FOLLOW = 5;

/* ---------------------------------------------------
 * BLOCK CHECK
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
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId)
      return res.status(400).json({ error: "You cannot follow yourself" });

    // privacy block check
    if (await isBlocked(currentUserId, targetUserId)) {
      return res.status(403).json({
        error: "Action blocked due to user privacy settings"
      });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId)
    ]);

    if (!targetUser)
      return res.status(404).json({ error: "User not found" });

    // already following?
    const already = currentUser.following?.some(id => id.toString() === targetUserId);
    if (already)
      return res.status(400).json({ error: "Already following this user" });

    // Save follow state
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUserId);
    currentUser.followingCount++;
    targetUser.followersCount++;

    await currentUser.save();
    await targetUser.save();

    /* ---------------------------------------------------
     * REWARD FOLLOWER (the user who clicks follow)
     * --------------------------------------------------- */
    const activityId = `follow_${currentUserId}_${targetUserId}_${Date.now()}`;

    const rewardTx = await rewardService.reward(currentUserId, REWARD_FOLLOW, {
      type: "REWARD_FOLLOW",
      description: `Followed ${targetUser.username}`,
      relatedUserId: targetUserId,
      activityId
    });

    /* ---------------------------------------------------
     * NOTIFICATION TO FOLLOWED USER (if not blocked)
     * --------------------------------------------------- */
    if (!(await isBlocked(targetUserId, currentUserId))) {
      await sendNotification({
        type: "follow",
        senderId: currentUserId,
        receiverId: targetUserId,
        activityId: `follow_notify_${currentUserId}_${targetUserId}`,
        message: `${currentUser.username} started following you.`
      });
    }

    /* ---------------------------------------------------
     * SOCKET UPDATE
     * --------------------------------------------------- */
    if (io) {
      io.emit("feedUpdate", {
        type: "newFollow",
        followerId: currentUserId,
        followedId: targetUserId,
        reward: rewardTx,
        timestamp: new Date(),
      });
    }

    return res.json({
      success: true,
      message: `You are now following ${targetUser.username}`,
      isFollowing: true,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount,
      coinsRewarded: rewardTx ? REWARD_FOLLOW : 0,
      timestamp: new Date(),
    });

  } catch (err) {
    console.error("❌ Follow error:", err);
    return res.status(500).json({ error: "Failed to follow user" });
  }
});



/* ---------------------------------------------------
 * GET USER'S FOLLOWING LIST
 * --------------------------------------------------- */
router.get('/:userId/following', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * Number(limit);

    const user = await User.findById(userId)
      .populate({
        path: "following",
        select: "username profileImage bio verified followersCount followingCount",
        options: { skip, limit: Number(limit) }
      });

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      following: user.following,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil((user.followingCount || 0) / limit),
        totalFollowing: user.followingCount,
        hasMore: skip + user.following.length < user.followingCount
      },
      timestamp: new Date(),
    });

  } catch (err) {
    console.error("❌ fetch following error:", err);
    return res.status(500).json({ error: "Failed to fetch following" });
  }
});



/* ---------------------------------------------------
 * UNFOLLOW
 * --------------------------------------------------- */
router.post('/:userId/unfollow', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId)
      return res.status(400).json({ error: "You cannot unfollow yourself" });

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId)
    ]);

    if (!targetUser)
      return res.status(404).json({ error: "User not found" });

    const isFollowing = currentUser.following.some(
      id => id.toString() === targetUserId
    );

    if (!isFollowing)
      return res.status(400).json({ error: "You are not following this user" });

    // Remove follow relation
    currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId);

    currentUser.followingCount = Math.max((currentUser.followingCount || 1) - 1, 0);
    targetUser.followersCount = Math.max((targetUser.followersCount || 1) - 1, 0);

    await currentUser.save();
    await targetUser.save();

    return res.json({
      success: true,
      message: `You unfollowed ${targetUser.username}`,
      isFollowing: false,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount,
    });

  } catch (err) {
    console.error("❌ Unfollow error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});



/* ---------------------------------------------------
 * FOLLOW STATS
 * --------------------------------------------------- */
router.get('/:userId/follow-stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    const user = await User.findById(userId).select(
      "followersCount followingCount followers createdAt updatedAt"
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    const isFollowedByCurrentUser = user.followers.some(id => id.toString() === currentUserId);

    return res.json({
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowedByCurrentUser,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

  } catch (err) {
    console.error("❌ Follow stats error:", err);
    return res.status(500).json({ error: "Failed to fetch follow stats" });
  }
});

module.exports = router;
