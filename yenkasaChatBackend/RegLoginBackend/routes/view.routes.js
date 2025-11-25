const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');


// ======================================================
// ⭐ NEW — Separate reward systems by media type
// ======================================================

function rewardImage(seconds) {
  if (seconds >= 5) return 2;
  if (seconds >= 3) return 1;
  return 0;
}

function rewardVideo(seconds) {
  if (seconds >= 120) return 20;
  if (seconds >= 60) return 10;
  if (seconds >= 30) return 5;
  if (seconds >= 10) return 2;
  return 0;
}

function rewardAudio(seconds) {
  if (seconds >= 90) return 10;
  if (seconds >= 45) return 5;
  if (seconds >= 20) return 2;
  return 0;
}


// ======================================================
// 👁️ Record View + Reward
// ======================================================
router.post('/:postId/view', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const {
      watchDuration = 0,
      mediaType = "unknown"  // 👈 ANDROID MUST SEND THIS
    } = req.body;

    const viewerId = req.user?.id;

    console.log(`📡 View request → Post:${postId} | Duration:${watchDuration}s | Type:${mediaType} | User:${viewerId}`);

    // Validate
    if (!viewerId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const [post, viewer] = await Promise.all([
      Post.findById(postId),
      User.findById(viewerId)
    ]);

    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (!viewer) return res.status(404).json({ success: false, message: "Viewer not found" });

    const objectIdPost = new mongoose.Types.ObjectId(postId);
    const activityId = `view_${postId}_${viewerId}_${Date.now()}`;

    // Save view
    await View.create({
      postId: objectIdPost,
      userId: viewerId,
      username: viewer.username,
      activityId,
      watchDuration,
       mediaType, 
      viewedAt: new Date()
    });

    // ======================================================
    // ⭐ NEW — Choose reward function based on media type
    // ======================================================
    let rewardAmount = 0;


// ⭐ match frontend simple rules
if (mediaType === "image") {
  if (watchDuration >= 3) rewardAmount = 1;
}

if (mediaType === "audio") {
  if (watchDuration >= 5) rewardAmount = 1;
}

if (mediaType === "video") {
  if (watchDuration >= 10) rewardAmount = 2;
}


    let rewardTx = null;

    if (rewardAmount > 0) {
      console.log(`🎁 Rewarding ${rewardAmount} coins → ${viewer.username}`);

      rewardTx = await rewardService.reward(viewerId, rewardAmount, {
        fromUserId: null,
        type: "REWARD_VIEWS",
        description: `Earned ${rewardAmount} coins for ${mediaType} view (${watchDuration}s)`,
        relatedPostId: post._id,
        activityId
      });

      post.coinsEarned = (post.coinsEarned || 0) + rewardAmount;
      await post.save();
    } else {
      console.log(`⏱️ No reward for ${mediaType} — duration too short`);
    }

    // Count views
    const viewsCount = await View.countDocuments({ postId: objectIdPost });

    // Emit live update
    if (global.io) {
      global.io.emit("viewUpdate", {
        postId,
        viewsCount,
        rewardAmount,
        viewerId,
        timestamp: new Date()
      });
    }

    return res.json({
      success: true,
      message: "View recorded",
      viewsCount,
      rewardAmount,
      rewardTransaction: rewardTx
    });

  } catch (error) {
    console.error("❌ Error recording view:", error);
    return res.status(500).json({ success: false, message: "Server error while recording view" });
  }
});


// ======================================================
// 📊 Get total views
// ======================================================
router.get('/:postId/views', authMiddleware, async (req, res) => {
  try {
    const objectIdPost = new mongoose.Types.ObjectId(req.params.postId);
    const viewsCount = await View.countDocuments({ postId: objectIdPost });

    res.json({
      success: true,
      postId: req.params.postId,
      viewsCount,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ Error fetching views:", error);
    res.status(500).json({ success: false, message: "Failed to fetch views" });
  }
});

module.exports = router;
