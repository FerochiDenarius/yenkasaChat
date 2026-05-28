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
const { publishYmeEvent } = require("../src/yme/services/eventPublisher.service");
const {
  REPEATED_VIEW_WINDOW_MS,
  REWARD_VALUES,
  startOfDay,
  getRequestIp,
  getDeviceId,
  logYkcActivity
} = require("../services/ykcEconomy.service");





// ======================================================
// ⭐ NEW — Separate reward systems by media type
// ======================================================

function rewardImage(seconds) {
  if (seconds >= 3) return REWARD_VALUES.REWARD_IMAGE_VIEW;
  return 0;
}

function rewardVideo(seconds) {
  if (seconds >= 30) return REWARD_VALUES.REWARD_LONG_WATCH;
  if (seconds >= 5) return REWARD_VALUES.REWARD_SHORT_VIDEO_VIEW;
  return 0;
}

function rewardAudio(seconds) {
  if (seconds >= 60) return REWARD_VALUES.REWARD_LONG_WATCH;
  if (seconds >= 20) return REWARD_VALUES.REWARD_AUDIO_VIEW;
  return 0;
}

function rewardText(seconds) {
  return seconds >= 3 ? REWARD_VALUES.REWARD_TEXT_VIEW : 0;
}

function mediaRewardCandidate(mediaType, seconds) {
  const type = (mediaType || '').toLowerCase();
  if (type === 'image') return { amount: rewardImage(seconds), type: 'REWARD_IMAGE_VIEW' };
  if (type === 'text') return { amount: rewardText(seconds), type: 'REWARD_TEXT_VIEW' };
  if (type === 'audio') {
    return seconds >= 60
      ? { amount: rewardAudio(seconds), type: 'REWARD_LONG_WATCH' }
      : { amount: rewardAudio(seconds), type: 'REWARD_AUDIO_VIEW' };
  }
  if (type === 'video') {
    return seconds >= 30
      ? { amount: rewardVideo(seconds), type: 'REWARD_LONG_WATCH' }
      : { amount: rewardVideo(seconds), type: 'REWARD_SHORT_VIDEO_VIEW' };
  }
  return { amount: 0, type: null };
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
const viewerIdStr = viewerId.toString();
const ownerIdStr = ownerId.toString();
const safeWatchDuration = Math.max(0, Number(watchDuration) || 0);
const ipAddress = getRequestIp(req);
const deviceId = getDeviceId(req);
const repeatedSince = new Date(Date.now() - REPEATED_VIEW_WINDOW_MS);
const recentView = await View.findOne({
  postId: objectIdPost,
  viewedAt: { $gte: repeatedSince },
  $or: [
    { userId: viewerId },
    ...(deviceId ? [{ deviceId }] : []),
    ...(ipAddress ? [{ ipAddress }] : [])
  ]
}).select('_id').lean();

const qualifiedView = safeWatchDuration >= 5 && !recentView;
const suspicious = Boolean(recentView);
const sessionActive = viewer.online !== false;
const monetizableOpportunity = qualifiedView && sessionActive && !suspicious;

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
  watchDuration: safeWatchDuration,
  viewsCount: 1,
  qualifiedView,
  monetizableOpportunity,
  ipAddress,
  deviceId
});

await logYkcActivity({
  userId: viewerId,
  postId: objectIdPost,
  action: "POST_VIEW",
  coinsAwarded: 0,
  timestamp: view.viewedAt,
  watchDuration: safeWatchDuration,
  qualifiedView,
  monetizableOpportunity,
  suspicious,
  ipAddress,
  deviceId,
  metadata: { mediaType, repeatedView: Boolean(recentView) }
});

if (qualifiedView || monetizableOpportunity) {
  await User.findByIdAndUpdate(viewerId, {
    $inc: {
      totalQualifiedViews: qualifiedView ? 1 : 0,
      totalWatchTime: qualifiedView ? safeWatchDuration : 0,
      totalMonetizableOpportunities: monetizableOpportunity ? 1 : 0
    }
  });
}



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
    // ⭐ YKC REWARD LOGIC
    // ---------------------------------------------------------------------
    const rewardCandidate = mediaRewardCandidate(mediaType, safeWatchDuration);
    let rewardAmount = Number(rewardCandidate.amount || 0);
    let rewardTx = null;
    let rewardBlockedReason = null;

    if (rewardAmount > 0 && rewardCandidate.type) {
      const alreadyRewardedForCheckpoint = await require('../models/cointransaction.model').exists({
        toUserId: viewerId,
        type: rewardCandidate.type,
        relatedPostId: objectIdPost,
        status: 'completed',
        createdAt: { $gte: startOfDay(new Date()) }
      });

      if (alreadyRewardedForCheckpoint) {
        rewardAmount = 0;
        rewardBlockedReason = 'already_rewarded_for_post_checkpoint_today';
      } else if (!sessionActive) {
        rewardAmount = 0;
        rewardBlockedReason = 'viewer_not_active';
      } else {
        rewardTx = await rewardService.reward(viewerId, rewardAmount, {
          type: rewardCandidate.type,
          description: `Earned ${rewardAmount} YKC for ${mediaType || 'feed'} engagement`,
          relatedPostId: postId,
          activityId: `${rewardCandidate.type}_${postId}_${viewerIdStr}_${safeWatchDuration}`
        });
        if (!rewardTx) {
          rewardAmount = 0;
          rewardBlockedReason = 'reward_guard_blocked';
        }
      }
    }

    console.log('[YKC View Reward]', {
      userId: viewerIdStr,
      postId,
      mediaType,
      rewardType: rewardCandidate.type,
      rewardAmount,
      previousBalance: rewardTx?.toUserBalanceBefore,
      newBalance: rewardTx?.toUserBalanceAfter,
      qualifiedView,
      watchDuration: safeWatchDuration,
      monetizableOpportunity,
      blockedReason: rewardBlockedReason
    });

    // Owner reward every 1000 qualified views (only if viewer != owner)
    if (qualifiedView && viewerIdStr !== ownerIdStr) {
      await rewardService.reward(ownerId, REWARD_VALUES.REWARD_POST_SINGLE_VIEW_RECEIVED, {
        type: "REWARD_POST_SINGLE_VIEW_RECEIVED",
        description: `Earned ${REWARD_VALUES.REWARD_POST_SINGLE_VIEW_RECEIVED} YKC because your post received a valid view`,
        relatedPostId: postId,
        activityId: `owner_view_received_${postId}_${viewerIdStr}_${view._id}`
      });

      const qualifiedViewsCount = await View.countDocuments({
        postId: objectIdPost,
        qualifiedView: true
      });

      if (qualifiedViewsCount > 0 && qualifiedViewsCount % 1000 === 0) {
const ownerActivityId = `owner_${activityId}`;

      await rewardService.reward(ownerId, REWARD_VALUES.REWARD_POST_VIEW_1000, {
        type: "REWARD_POST_VIEW_RECEIVED",
        description: `Earned ${REWARD_VALUES.REWARD_POST_VIEW_1000} YKC for 1000 valid views`,
        relatedPostId: postId,
        activityId: ownerActivityId
      });
      }
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
              data: {
                type: "view_milestone",
                targetType: "post",
                targetId: postId,
                activityId: postId,
                postId
              }
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
        qualifiedView,
        monetizableOpportunity,
        viewerId: viewerId.toString(),
        timestamp: new Date()
      });
    }

    publishYmeEvent({
      userId: viewerIdStr,
      sourceApp: "social_app",
      eventType: mediaType === "video" || post.postType === "video" ? "video_watch" : "post_viewed",
      postId,
      creatorId: post.userId,
      communityId: post.communityId,
      contentId: `post:${postId}`,
      caption: post.text || "",
      categories: post.tags || [],
      watchTimeMs: Math.round(safeWatchDuration * 1000),
      payload: {
        mediaType: mediaType || post.postType || "unknown",
        qualifiedView,
        monetizableOpportunity,
        rewardType: rewardCandidate.type,
        rewardAmount,
      },
    });

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
      newBalance: rewardTx?.toUserBalanceAfter ?? null,
      rewardType: rewardCandidate.type,
      qualifiedView,
      monetizableOpportunity,
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
