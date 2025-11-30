const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const rewardService = require('../services/reward.service');

// Place at top
const UserPrivacy = require("../models/userPrivacy.model");

async function isBlocked(userA, userB) {
  const [privacyA, privacyB] = await Promise.all([
    UserPrivacy.findOne({ userId: userA }).lean(),
    UserPrivacy.findOne({ userId: userB }).lean()
  ]);

  const aBlockedB = privacyA?.blockedUsers?.includes(userB);
  const bBlockedA = privacyB?.blockedUsers?.includes(userA);

  return aBlockedB || bBlockedA;
}



const REWARD_FOLLOW = 5;

//followc a user.

router.post('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const io = req.app.get("io"); // ⭐ FIX HERE

    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    if (await isBlocked(currentUserId, targetUserId)) {
      return res.status(403).json({ error: "Action blocked due to user privacy settings" });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const isAlreadyFollowing = currentUser.following?.some(
      id => id.toString() === targetUserId
    ) || false;

    if (isAlreadyFollowing) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // SAVE FOLLOW
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUserId);
    currentUser.followingCount++;
    targetUser.followersCount++;

    await currentUser.save();
    await targetUser.save();

     } catch (err) {
    console.error("❌ Failed to follow user:", err);
    return res.status(500).json({ error: "Failed to follow user" });
  }

  });


// ✅ Get user's following
router.get('/:userId/following', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username profileImage bio verified followersCount followingCount',
        options: { skip, limit: parseInt(limit) },
      });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      following: user.following,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(user.followingCount / limit),
        totalFollowing: user.followingCount,
        hasMore: skip + user.following.length < user.followingCount,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('❌ Failed to fetch following:', err);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// ✅ Unfollow a user
router.post('/:userId/unfollow', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'You cannot unfollow yourself' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUserId
    );
    if (!isFollowing) {
      return res.status(400).json({ error: 'You are not following this user' });
    }

    // ✅ Remove follow relationships
    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== targetUserId
    );
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() !== currentUserId
    );

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
    console.error('❌ Unfollow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Get follow stats for a user
router.get('/:userId/follow-stats', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const user = await User.findById(userId).select(
      'followersCount followingCount followers updatedAt createdAt'
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const isFollowedByCurrentUser = user.followers.some(
      id => id.toString() === currentUserId
    );

    res.json({
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowedByCurrentUser,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    console.error('❌ Failed to fetch follow stats:', err);
    res.status(500).json({ error: 'Failed to fetch follow stats' });
  }
});

module.exports = router;
