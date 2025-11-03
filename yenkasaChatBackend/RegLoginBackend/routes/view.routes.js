// routes/view.routes.js
const express = require('express');
const router = express.Router();
const View = require('../models/view.model');
const Post = require('../models/post.model');
const { verifyToken } = require('../middleware/auth.middleware');

// ---------------------------------------------
// 👁️ Add or record a view for a post
// ---------------------------------------------
router.post('/feed/:postId/view', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if this user already viewed it
    const alreadyViewed = await View.findOne({ post: postId, user: userId });
    if (!alreadyViewed) {
      await View.create({ post: postId, user: userId });
    }

    // Count total unique views
    const viewsCount = await View.countDocuments({ post: postId });

    return res.json({
      success: true,
      message: 'View recorded',
      viewsCount
    });
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
