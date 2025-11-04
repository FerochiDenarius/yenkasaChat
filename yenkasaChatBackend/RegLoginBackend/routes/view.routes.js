// routes/view.routes.js
const express = require('express');
const router = express.Router();
const View = require('../models/view.model');
const Post = require('../models/post.model');
const authMiddleware = require('../middleware/auth');

// ---------------------------------------------
// 👁️ Record a unique view for a post + emit socket event
// ---------------------------------------------
router.post('/:postId/view', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // ✅ Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // ✅ Check if already viewed
    const alreadyViewed = await View.findOne({ post: postId, user: userId });

    if (!alreadyViewed) {
      await View.create({ post: postId, user: userId });

      // ✅ Count total views after new view
      const viewsCount = await View.countDocuments({ post: postId });

      // 🟢 Emit socket event using global.io
      if (global.io) {
        global.io.emit('viewUpdate', {
          postId,
          viewsCount,
          viewerId: userId,
          timestamp: new Date(),
        });
      }

      return res.json({
        success: true,
        message: 'View recorded successfully',
        viewsCount,
      });
    }

    // If already viewed
    const viewsCount = await View.countDocuments({ post: postId });
    return res.json({
      success: true,
      message: 'View already recorded',
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
