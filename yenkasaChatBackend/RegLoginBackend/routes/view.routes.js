const express = require('express');
const router = express.Router();
const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');

const REWARD_VIEW = 2; // reward per view

// ---------------------------------------------
// 👁️ Record a view for a post + reward coins + emit socket
// ---------------------------------------------
router.post('/:postId/view', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // ✅ Verify post exists
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    // ✅ Always create a view
    await View.create({ post: postId, user: userId });

    // ✅ Reward post author if not self
    if (post.userId.toString() !== userId) {
      const postAuthor = await User.findById(post.userId);
      if (postAuthor) {
        postAuthor.coinsBalance += REWARD_VIEW;
        post.coinsEarned += REWARD_VIEW;
        await postAuthor.save();
        
        await CoinTransaction.create({
          fromUserId: userId,
          toUserId: postAuthor._id,
          amount: REWARD_VIEW,
          type: 'REWARD_VIEW',
          description: 'Reward for post view',
          relatedPostId: post._id,
        });
      }
    }

    // ✅ Count total views after new view
    const viewsCount = await View.countDocuments({ post: postId });

    // ✅ Emit socket event using global.io
    if (global.io) {
      global.io.emit('viewUpdate', {
        postId,
        viewsCount,
        viewerId: userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: 'View recorded successfully',
      viewsCount,
    });

  } catch (error) {
    console.error('❌ Error recording view:', error);
    res.status(500).json({ success: false, message: 'Server error while recording view' });
  }
});

// ---------------------------------------------
// 📊 Get total views for a post
// ---------------------------------------------
router.get('/:postId/views', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewsCount = await View.countDocuments({ post: postId });

    res.json({
      success: true,
      postId,
      viewsCount,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('❌ Error fetching view count:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch view count' });
  }
});

module.exports = router;
