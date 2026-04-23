const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const View = require('../models/view.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const rewardService = require('../services/reward.service');
const { sendNotification } = require("../services/notification.service");
const { toObjectId } = require("../utils/postViewCounts");
const { sendPushNotification } = require("../utils/onesignal");





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

router.post('/:postId/view', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { watchDuration = 0, mediaType = "unknown" } = req.body;
    const viewerId = req.user?._id || req.user?.userId || req.user?.id;

    if (!viewerId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const objectIdPost = toObjectId(postId);
    if (!objectIdPost) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    // ---------------------------------------------------------------------
    // LOAD REQUIRED DATA
    // ---------------------------------------------------------------------
    const [post, viewer] = await Promise.all([
      Post.findById(objectIdPost),
      User.findById(viewerId)
    ]);

    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (!viewer) return res.status(404).json({ success: false, message: "Viewer not found" });

    const ownerId = post.userId.toString();

// ---------------------------------------------------------------------
// Single activityId used for View record + Reward entry
// ---------------------------------------------------------------------
const activityId = new mongoose.Types.ObjectId().toString();

// ---------------------------------------------------------------------
// CREATE NEW VIEW RECORD (Option A — every view counts)
// ---------------------------------------------------------------------
const view = await View.create({
  activityId,
  postId: objectIdPost,
  userId: viewerId,
  username: viewer.username,
  mediaType,
  viewedAt: new Date(),
  watchDuration,
  viewsCount: 1
});



    // ---------------------------------------------------------------------
    // FOREIGN REFERENCE → add viewObject to Post.views[]
    // ---------------------------------------------------------------------
    await Post.findByIdAndUpdate(objectIdPost, {
      $addToSet: { views: view._id }
    });

    // ---------------------------------------------------------------------
    // RECALCULATE TRUE VIEW COUNT
    // ---------------------------------------------------------------------
    const viewsCount = await View.countDocuments({ postId: objectIdPost });

    // ---------------------------------------------------------------------
    // SYNC LEGACY FIELD FOR ANDROID (viewCount)
    // ---------------------------------------------------------------------
    const updatedPost = await Post.findByIdAndUpdate(
      objectIdPost,
      { $set: { viewCount: viewsCount } },
      { new: true, select: "_id viewCount" }
    ).lean();

    // ---------------------------------------------------------------------
    // ⭐ REWARD LOGIC
    // ---------------------------------------------------------------------
let rewardAmount = 0;

switch (mediaType) {
  case "image":
    rewardAmount = rewardImage(watchDuration);
    break;
  case "video":
    rewardAmount = rewardVideo(watchDuration);
    break;
  case "audio":
    rewardAmount = rewardAudio(watchDuration);
    break;
  default:
    rewardAmount = 0;
}


    let rewardTx = null;

    // Viewer’s reward
    if (rewardAmount > 0) {
      rewardTx = await rewardService.reward(viewerId, rewardAmount, {
        type: "REWARD_POST_VIEW",
        description: `Earned ${rewardAmount} coins for viewing ${mediaType}`,
        relatedPostId: postId,
        activityId
      });
    }

    // Owner reward (only if viewer != owner)
    if (viewerId !== ownerId) {
const ownerActivityId = `owner_${activityId}`;

      await rewardService.reward(ownerId, 1, {
        type: "REWARD_POST_VIEW_RECEIVED",
        description: "Earned 1 YKC for receiving a view",
        relatedPostId: postId,
        activityId: ownerActivityId
      });
    }

    // ---------------------------------------------------------------------
    // ⭐⭐ MILESTONE BLOCK (REINSERTED CORRECTLY)
    // ---------------------------------------------------------------------
    const milestones = [
      100000, 500000, 1000000,
      2000000, 3000000, 5000000,
      10000000
    ];

    for (const milestone of milestones) {
      if (viewsCount >= milestone && !(post.milestones || []).includes(milestone)) {

        console.log(`🎉 MILESTONE HIT → ${milestone} views for post ${postId}`);

        post.milestones = post.milestones || [];
        post.milestones.push(milestone);
        await post.save();

        const owner = await User.findById(ownerId);

        // SEND IN-APP NOTIFICATION
        if (owner) {
          await sendNotification({
            type: "view_milestone",
            senderId: viewerId,
            receiverId: owner._id.toString(),
            activityId: postId,
            message: `Your post just hit ${milestone.toLocaleString()} views!`,
            targetType: "post",
            targetId: postId
          });

          // PUSH NOTIFICATION
          if (owner.playerId) {
            await sendPushNotification({
              playerId: owner.playerId,
              title: "🎉 Post Milestone!",
              body: `Your post reached ${milestone.toLocaleString()} views.`,
              data: { postId }
            });
          }
        }
      }
    }

    // ---------------------------------------------------------------------
    // ⭐ SOCKET → REAL-TIME UPDATE
    // ---------------------------------------------------------------------
    if (global.io) {
      global.io.emit("viewUpdate", {
        postId: objectIdPost.toString(),
        viewsCount: updatedPost?.viewCount ?? viewsCount,
        viewCount: updatedPost?.viewCount ?? viewsCount,
        rewardAmount,
        viewerId: viewerId.toString(),
        timestamp: new Date()
      });
    }

    // ---------------------------------------------------------------------
    // FINAL RESPONSE
    // ---------------------------------------------------------------------
    return res.json({
      success: true,
      message: "View recorded",
      viewsCount: updatedPost?.viewCount ?? viewsCount,
      viewCount: updatedPost?.viewCount ?? viewsCount,
      view,
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
    const objectIdPost = toObjectId(req.params.postId);
    if (!objectIdPost) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const viewsCount = await View.countDocuments({ postId: objectIdPost });
    await Post.findByIdAndUpdate(objectIdPost, { $set: { viewCount: viewsCount } });

    res.json({
      success: true,
      postId: req.params.postId,
      viewsCount,
      viewCount: viewsCount,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ Error fetching views:", error);
    res.status(500).json({ success: false, message: "Failed to fetch views" });
  }
});

module.exports = router;
