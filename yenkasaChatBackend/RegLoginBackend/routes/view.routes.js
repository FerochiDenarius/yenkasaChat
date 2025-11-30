const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');
const { sendNotification } = require("../services/notification.service");





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

    // ======================================
    // Save view record
    // ======================================
    await View.create({
      postId: objectIdPost,
      userId: viewerId,
      username: viewer.username,
      activityId,
      watchDuration,
      mediaType,
      viewedAt: new Date()
    });

    // ======================================
    // ⭐ NEW: Increment Post.viewCount properly
    // ======================================
    await Post.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });


    // ======================================
    // ⭐ Your media–type reward logic (unchanged)
    // ======================================
    let rewardAmount = 0;

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

    // ======================================================
    // ⭐ FIX #1 — Viewer reward type must NOT be REWARD_VIEWS
    // It must be REWARD_POST_VIEW (so AppVerification does not
    // think this is an AD view)
    // ======================================================
    if (rewardAmount > 0) {
      console.log(`🎁 Rewarding ${rewardAmount} coins → ${viewer.username}`);

      rewardTx = await rewardService.reward(viewerId, rewardAmount, {
        fromUserId: null,
        type: "REWARD_POST_VIEW",  // ✅ FIXED (previously REWARD_VIEWS)
        description: `Earned ${rewardAmount} coins for ${mediaType} view (${watchDuration}s)`,
        relatedPostId: post._id,
        activityId
      });

      post.coinsEarned = (post.coinsEarned || 0) + rewardAmount;
      await post.save();
    } else {
      console.log(`⏱️ No reward for ${mediaType} — duration too short`);
    }


    // ======================================================
    // ⭐ FIX #2 — Reward post owner for RECEIVING a view
    // ======================================================
    if (post.userId.toString() !== viewerId) {
      await rewardService.reward(post.userId, 1, {
        fromUserId: viewerId,
        type: "REWARD_POST_VIEW",  // same correct type
        description: "Earned 1 YKC for receiving a view",
        relatedPostId: post._id,
        activityId: `view_received_${postId}_${viewerId}_${Date.now()}`
      });
    }


    // ======================================================
    // Count views (your logic preserved)
    // ======================================================
    const viewsCount = await View.countDocuments({ postId: objectIdPost });


    // ======================================================
    // ⭐ MILESTONE LOGIC (UNTOUCHED)
    // ======================================================
    const milestones = [100000, 500000, 1000000, 2000000, 3000000, 5000000, 10000000];

    for (const milestone of milestones) {
      if (viewsCount >= milestone && !(post.milestones || []).includes(milestone)) {

        console.log(`🎉 MILESTONE HIT → ${milestone} views for post ${postId}`);

        post.milestones = post.milestones || [];
        post.milestones.push(milestone);
        await post.save();

        const owner = await User.findById(post.userId);

        if (owner) {
          await sendNotification({
            type: "view_milestone",
            senderId: viewerId,
            receiverId: owner._id.toString(),
            activityId: `view_milestone_${postId}_${milestone}`,
            message: `Your post just hit ${milestone.toLocaleString()} views!`
          });

          if (owner.oneSignalPlayerId) {
            const payload = {
              app_id: process.env.ONESIGNAL_APP_ID,
              include_player_ids: [owner.oneSignalPlayerId],
              headings: { en: "🎉 Post Milestone!" },
              contents: { en: `Your post reached ${milestone.toLocaleString()} views.` },
              data: { postId }
            };

            await fetch("https://onesignal.com/api/v1/notifications", {
              method: "POST",
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                Authorization: `Basic ${process.env.ONESIGNAL_KEY}`
              },
              body: JSON.stringify(payload)
            });
          }
        }
      }
    }


    // ======================================
    // Emit live update (unchanged)
    // ======================================
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
