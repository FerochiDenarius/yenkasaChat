// routes/post.routes.js
const express = require('express');
const router = express.Router();
const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');

// Coin reward amounts
const REWARDS = {
  CREATE_POST: 10,
  GET_LIKE: 2,
  GET_COMMENT: 3
};

// ✅ Create a new post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      text,
      imageUrl,
      videoUrl,
      mediaUrls,
      tags,
      location,
      visibility,
      postType,
      mentions
    } = req.body;

    const userId = req.user.id;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Post text is required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.community) {
      return res.status(400).json({ error: 'You must join a community first' });
    }

    // 📝 Create new post
    const post = new Post({
      userId,
      communityId: user.community,
      text: text.trim(),
      postType: postType || 'text',
      imageUrl: imageUrl || '',
      videoUrl: videoUrl || '',
      mediaUrls: mediaUrls || [],
      tags: tags || [],
      mentions: mentions || [],
      location: location || '',
      visibility: visibility || 'public',
      status: 'approved'
    });

    await post.save();

    // 📈 Increment community post count
    const community = await Community.findById(user.community);
    if (community && typeof community.incrementPostCount === 'function') {
      await community.incrementPostCount();
    }

    // 💰 Reward coins for creating post (only if verified)
    if (user.verified) {
      const rewardAmount = REWARDS.CREATE_POST;
      user.coinsBalance += rewardAmount;
      post.coinsEarned = rewardAmount;
      await user.save();
      await post.save();

      await CoinTransaction.create({
        toUserId: userId,
        amount: rewardAmount,
        type: 'REWARD_POST',
        description: 'Reward for creating a post',
        relatedPostId: post._id,
        toUserBalanceBefore: user.coinsBalance - rewardAmount,
        toUserBalanceAfter: user.coinsBalance
      });
    }

    // 🧩 Populate references for response
    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName')
      .lean();

    res.status(201).json({
      success: true,
      message: user.verified
        ? `Post created! You earned ${REWARDS.CREATE_POST} coins.`
        : 'Post created!',
      post: populatedPost,
      coinsEarned: user.verified ? REWARDS.CREATE_POST : 0
    });
  } catch (err) {
    console.error('❌ Failed to create post:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ✅ Get community feed
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, communityId } = req.query;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const targetCommunityId = communityId || user.community;
    if (!targetCommunityId) {
      return res.status(400).json({ error: 'No community specified' });
    }

    const skip = (page - 1) * limit;
    const posts = await Post.find({
      communityId: targetCommunityId,
      isActive: true,
      visibility: { $in: ['public', 'followers'] },
      status: 'approved'
    })
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName')
      .lean();

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      likedByCurrentUser: post.likes.some(id => id.toString() === userId)
    }));

    const totalPosts = await Post.countDocuments({
      communityId: targetCommunityId,
      isActive: true,
      status: 'approved'
    });

    res.json({
      posts: postsWithLikeStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch feed:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// ✅ Get user posts
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ userId, isActive: true, status: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName')
      .lean();

    const totalPosts = await Post.countDocuments({
      userId,
      isActive: true,
      status: 'approved'
    });

    res.json({
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch user posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ✅ Like a post
router.post('/:postId/like', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const wasLiked = await post.addLike(userId);

    if (wasLiked) {
      const postAuthor = await User.findById(post.userId);
      if (postAuthor && postAuthor._id.toString() !== userId) {
        const rewardAmount = REWARDS.GET_LIKE;
        postAuthor.coinsBalance += rewardAmount;
        post.coinsEarned += rewardAmount;
        await postAuthor.save();
        await post.save();

        await CoinTransaction.create({
          fromUserId: userId,
          toUserId: post.userId,
          amount: rewardAmount,
          type: 'REWARD_LIKE',
          description: 'Reward for receiving a like',
          relatedPostId: post._id
        });
      }
    }

    res.json({
      success: true,
      liked: wasLiked,
      likeCount: post.likeCount,
      coinsRewarded: wasLiked ? REWARDS.GET_LIKE : 0
    });
  } catch (err) {
    console.error('❌ Failed to like post:', err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// ✅ Unlike a post
router.delete('/:postId/like', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const wasUnliked = await post.removeLike(userId);

    res.json({
      success: true,
      unliked: wasUnliked,
      likeCount: post.likeCount
    });
  } catch (err) {
    console.error('❌ Failed to unlike post:', err);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// ✅ Delete a post
router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    post.isActive = false;
    await post.save();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (err) {
    console.error('❌ Failed to delete post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
