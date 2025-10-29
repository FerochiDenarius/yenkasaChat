// routes/follow.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');

const REWARD_FOLLOW = 5;

// ✅ Follow a user
router.post('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;
    
    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }
    
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already following
    const isAlreadyFollowing = currentUser.following.some(
      id => id.toString() === targetUserId
    );
    
    if (isAlreadyFollowing) {
      return res.status(400).json({ error: 'Already following this user' });
    }
    
    // Add to following/followers lists
    currentUser.following.push(targetUserId);
    currentUser.followingCount += 1;
    
    targetUser.followers.push(currentUserId);
    targetUser.followersCount += 1;
    
    await currentUser.save();
    await targetUser.save();
    
    // Reward the person being followed
    targetUser.coinsBalance += REWARD_FOLLOW;
    await targetUser.save();
    
    // Record transaction
    await CoinTransaction.create({
      fromUserId: currentUserId,
      toUserId: targetUserId,
      amount: REWARD_FOLLOW,
      type: 'REWARD_FOLLOW',
      description: 'Reward for gaining a follower'
    });
    
    res.json({
      success: true,
      message: `You are now following ${targetUser.username}`,
      isFollowing: true,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount,
      coinsRewarded: REWARD_FOLLOW
    });
  } catch (err) {
    console.error('❌ Failed to follow user:', err);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// ✅ Unfollow a user
router.delete('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;
    
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove from following/followers lists
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== targetUserId
    );
    currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
    
    targetUser.followers = targetUser.followers.filter(
      id => id.toString() !== currentUserId
    );
    targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
    
    await currentUser.save();
    await targetUser.save();
    
    res.json({
      success: true,
      message: `You unfollowed ${targetUser.username}`,
      isFollowing: false,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount
    });
  } catch (err) {
    console.error('❌ Failed to unfollow user:', err);
    res.status(500).json({ error: 'Failed to unfollow user' });
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
        select: 'username profileImage bio verified',
        options: {
          skip,
          limit: parseInt(limit)
        }
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      followers: user.followers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(user.followersCount / limit),
        totalFollowers: user.followersCount,
        hasMore: skip + user.followers.length < user.followersCount
      }
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
        select: 'username profileImage bio verified',
        options: {
          skip,
          limit: parseInt(limit)
        }
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      following: user.following,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(user.followingCount / limit),
        totalFollowing: user.followingCount,
        hasMore: skip + user.following.length < user.followingCount
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch following:', err);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// ✅ Get follow stats for a user
router.get('/:userId/follow-stats', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    const user = await User.findById(userId)
      .select('followersCount followingCount followers');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isFollowedByCurrentUser = user.followers.some(
      id => id.toString() === currentUserId
    );
    
    res.json({
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      isFollowedByCurrentUser
    });
  } catch (err) {
    console.error('❌ Failed to fetch follow stats:', err);
    res.status(500).json({ error: 'Failed to fetch follow stats' });
  }
});

module.exports = router;