// routes/view.routes.js
const express = require('express');
const router = express.Router();
const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

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

    // ✅ Always create a view record (no duplicate check here)
    await View.create({ post: postId, user: viewerId });

    // ✅ Reward the viewer (not the author)
    const viewer = await User.findById(viewerId);
    if (!viewer) {
      return res.status(404).json({ success: false, message: 'Viewer not found' });
    }

    const beforeBalance = viewer.coinsBalance || 0;
    const rewardAmount = REWARD_VIEW;
    const afterBalance = beforeBalance + rewardAmount;

    viewer.coinsBalance = afterBalance;
    await viewer.save();

    // 🧾 Record the transaction (System → Viewer)
    const rewardTransaction = await CoinTransaction.create({
      transactionId: uuidv4(),
      fromUserId: null,
      toUserId: viewer._id,
      fromUsername: 'System',
      toUsername: viewer.username,
      fromWalletId: null,
      toWalletId: viewer.walletId,
      amount: rewardAmount,
      type: 'REWARD_VIEWS', // ✅ corrected
      description: `Earned ${rewardAmount} YKC for viewing ${post.title || 'a post'}`,
      fromUserBalanceBefore: null,
      fromUserBalanceAfter: null,
      toUserBalanceBefore: beforeBalance,
      toUserBalanceAfter: afterBalance,
      status: 'completed',
      relatedPostId: post._id
    });

    // ✅ Update post stats
    post.coinsEarned = (post.coinsEarned || 0) + rewardAmount;
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
        rewardTransaction
      });
    }

    return res.json({
      success: true,
      message: `View recorded successfully. ${rewardAmount} YKC rewarded to ${viewer.username}`,
      viewsCount,
      rewardTransaction
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
