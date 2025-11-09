// routes/view.routes.js
const express = require('express');
const router = express.Router();
const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');

const REWARD_VIEW = 2; // coins per view

// ---------------------------------------------
// 👁️ Record a view + reward viewer coins
// ---------------------------------------------
router.post('/:postId/view', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.user.id;

    // ✅ Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // ✅ Fetch viewer info (needed for response)
    const viewer = await User.findById(viewerId);
    if (!viewer) {
      return res.status(404).json({ success: false, message: 'Viewer not found' });
    }

    // ✅ Always record the view (you can later dedupe if needed)
    await View.create({ post: postId, user: viewerId });

    // ✅ Reward the viewer (System → Viewer)
    const tx = await rewardService.reward(viewerId, REWARD_VIEW, {
      fromUserId: null,
      type: 'REWARD_VIEWS',
      description: `Earned ${REWARD_VIEW} YKC for viewing post ${post._id}`,
      relatedPostId: post._id,
      activityId: `view_${post._id}_${viewerId}` // remove Date.now() if you want to dedupe
    });

    if (!tx) {
      return res.status(200).json({
        success: true,
        message: 'View recorded (no reward due to duplicate or supply limit)',
      });
    }

    // ✅ Update post stats
    post.coinsEarned = (post.coinsEarned || 0) + REWARD_VIEW;
    await post.save();

    // ✅ Count total views
    const viewsCount = await View.countDocuments({ post: postId });

    // ✅ Optional socket event
    if (global.io) {
      global.io.emit('viewUpdate', {
        postId,
        viewsCount,
        viewerId,
        timestamp: new Date(),
        rewardTransaction: tx,
      });
    }

    return res.json({
      success: true,
      message: `View recorded successfully. ${REWARD_VIEW} YKC rewarded to ${viewer.username}`,
      viewsCount,
      rewardTransaction: tx,
    });

  } catch (error) {
    console.error('❌ Error recording view:', error);
    return res.status(500).json({ success: false, message: 'Server error while recording view' });
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
