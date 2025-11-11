const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');

// ---------------------------------------------
// 🎥 Reward tiers based on watch duration (seconds)
// ---------------------------------------------
function getRewardForDuration(seconds) {
  if (seconds >= 120) return 20; // 2 minutes+
  if (seconds >= 60) return 10;  // 1 minute+
  if (seconds >= 30) return 5;   // 30s+
  if (seconds >= 10) return 2;   // 10s+
  return 0;                      // <10s → no reward
}

// ---------------------------------------------
// 👁️ Record view and reward viewer dynamically
// ---------------------------------------------
router.post('/:postId/view', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { watchDuration = 0 } = req.body;
    const viewerId = req.user?.id;

    console.log(`📡 Incoming view request → Post: ${postId}, Watch: ${watchDuration}s, User: ${viewerId}`);

    // ✅ Validate user and post
    if (!viewerId) return res.status(401).json({ success: false, message: 'Unauthorized: Missing user ID' });

    const [post, viewer] = await Promise.all([
      Post.findById(postId),
      User.findById(viewerId)
    ]);

    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (!viewer) return res.status(404).json({ success: false, message: 'Viewer not found' });

    // ✅ Consistent ObjectId casting
    const objectIdPost = new mongoose.Types.ObjectId(postId);

    const activityId = `view_${postId}_${viewerId}_${Date.now()}`;

    // ✅ Record view
    const view = await View.create({
      postId: objectIdPost,
      userId: viewerId,
      username: viewer.username,
      activityId,
      watchDuration,
      viewedAt: new Date()
    });

    // ✅ Determine and apply reward
    const rewardAmount = getRewardForDuration(watchDuration);
    let rewardTx = null;

    if (rewardAmount > 0) {
      console.log(`🎁 Reward attempt: ${rewardAmount} YKC → ${viewer.username}`);

      try {
        rewardTx = await rewardService.reward(viewerId, rewardAmount, {
          fromUserId: null,
          type: 'REWARD_VIEWS',
          description: `Earned ${rewardAmount} YKC for watching post ${post._id} (${watchDuration}s)`,
          relatedPostId: post._id,
          activityId
        });

        if (!rewardTx) {
          console.warn('⚠️ Reward service returned null — transaction not recorded');
        }

        // ✅ Update post’s earned coins
        post.coinsEarned = (post.coinsEarned || 0) + rewardAmount;
        await post.save();
      } catch (err) {
        console.error('❌ Error applying reward:', err);
      }
    } else {
      console.log('⏱️ No reward — duration too short (<10s)');
    }

    // ✅ Accurate total views count
    const viewsCount = await View.countDocuments({ postId: objectIdPost });

    // ✅ Emit socket event if available
    if (global.io) {
      global.io.emit('viewUpdate', {
        postId,
        viewsCount,
        viewerId,
        rewardAmount,
        timestamp: new Date(),
        rewardTransaction: rewardTx
      });
    } else {
      console.warn('⚠️ global.io not initialized — skipping socket emit');
    }

    return res.json({
      success: true,
      message: `View recorded (${watchDuration}s). ${rewardAmount ? `${rewardAmount} YKC rewarded.` : 'No reward (less than 10s).'}`,
      viewsCount,
      rewardAmount,
      rewardTransaction: rewardTx
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
    const objectIdPost = new mongoose.Types.ObjectId(postId);
    const viewsCount = await View.countDocuments({ postId: objectIdPost });

    res.json({
      success: true,
      postId,
      viewsCount,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Error fetching view count:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch view count' });
  }
});

module.exports = router;
