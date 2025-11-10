const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const rewardService = require('../services/reward.service');


const REWARD_FOLLOW = 5;

// ✅ Follow a user
router.post('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isAlreadyFollowing = currentUser.following.some(
      (id) => id.toString() === targetUserId
    );
    if (isAlreadyFollowing) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // ✅ Update follow lists
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUserId);
    currentUser.followingCount = (currentUser.followingCount || 0) + 1;
    targetUser.followersCount = (targetUser.followersCount || 0) + 1;
    currentUser.updatedAt = new Date();
    targetUser.updatedAt = new Date();

    await currentUser.save();
    await targetUser.save();

    // ✅ Create unique activity ID
    const activityId = `follow_${currentUserId}_${targetUserId}`;

    // ✅ Attempt reward via service (handles dedupe)
    const rewardTx = await rewardService.reward(currentUserId, REWARD_FOLLOW, {
      fromUserId: null,
      type: 'REWARD_FOLLOW',
      description: `Earned ${REWARD_FOLLOW} YKC for following ${targetUser.username}`,
      activityId,
    });

    // ✅ Emit socket event
    io.emit('feedUpdate', {
      type: 'newFollow',
      followerId: currentUserId,
      followedId: targetUserId,
      reward: rewardTx,
      timestamp: new Date(),
    });

    // ✅ Notify followed user
    if (targetUser.oneSignalPlayerId) {
      const notificationData = {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [targetUser.oneSignalPlayerId],
        headings: { en: 'New Follower' },
        contents: { en: `${currentUser.username} started following you.` },
        data: { followerId: currentUserId },
      };

      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${process.env.ONESIGNAL_KEY}`,
        },
        body: JSON.stringify(notificationData),
      });
    }

    return res.json({
      success: true,
      message: `You are now following ${targetUser.username}`,
      isFollowing: true,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount,
      coinsRewarded: rewardTx ? REWARD_FOLLOW : 0,
      transaction: rewardTx,
      timestamp: new Date(),
    });

  } catch (err) {
    console.error('❌ Failed to follow user:', err);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});


// ✅ Get user's followers
router.get('/:userId/followers', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username profileImage bio verified followersCount followingCount',
        options: { skip, limit: parseInt(limit) },
      });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      followers: user.followers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(user.followersCount / limit),
        totalFollowers: user.followersCount,
        hasMore: skip + user.followers.length < user.followersCount,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('❌ Failed to fetch followers:', err);
    res.status(500).json({ error: 'Failed to fetch followers' });
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
