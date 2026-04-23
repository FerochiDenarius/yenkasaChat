const Ad = require('../models/Ad.model');
const AdView = require('../models/AdView.model');
const User = require('../models/user.model');
const RewardTx = require('../models/Rewards.Transaction.model');
const { SYSTEM_USER_ID } = require('../config/system');
const { sendNotification } = require('../services/notification.service');


// GET /ads/feed?page=&limit=
exports.getAdsFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page-1)*limit;

    const ads = await Ad.find({ isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    res.json({ success:true, ads });
  } catch(err){ res.status(500).json({ success:false, err: err.message }); }
};

// POST /ads/view/:adId  (called after the ad finishes; include duration + fullyWatched boolean)
exports.recordAdView = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.params;
    const { durationMs = 0, fullyWatched = false, deviceInfo = {} } = req.body;

    const ad = await Ad.findById(adId);
    if(!ad) return res.status(404).json({ success:false, message:'Ad not found' });

    const adView = new AdView({ adId, userId, durationMs, fullyWatched, deviceInfo });
    await adView.save();

    // increment impressions
    ad.impressions = (ad.impressions||0) + 1;
    await ad.save();

    return res.json({ success:true, adViewId: adView._id, fullyWatched });
  } catch(err){ console.error(err); res.status(500).json({ success:false }); }
};

exports.rewardAdClick = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.params;

    // Prevent double rewards: 1 click per ad per user
    const existing = await RewardTx.findOne({
      userId,
      adId,
      type: "AD_CLICK_REWARD"
    });

    if (existing) {
      return res.json({
        success: false,
        message: "Already rewarded for clicking this ad"
      });
    }

    const rewardAmount = 5;

    // Create reward transaction
    const tx = new RewardTx({
      userId,
      type: "AD_CLICK_REWARD",
      adId,
      amount: rewardAmount,
      meta: { note: "Reward for clicking ad" }
    });

    await tx.save();

    // Update user balance
    await User.findByIdAndUpdate(userId, {
      $inc: { coins: rewardAmount }
    });

    const rewardMessage = `You earned ${rewardAmount} YKC for clicking an ad.`;
    await sendNotification({
      type: "reward",
      senderId: SYSTEM_USER_ID,
      receiverId: userId,
      activityId: tx._id.toString(),
      targetType: "wallet",
      targetId: tx._id.toString(),
      message: rewardMessage,
      push: true,
      pushTitle: "Reward earned",
      pushBody: rewardMessage,
      pushData: {
        transactionId: tx._id.toString(),
        rewardType: tx.type,
        amount: rewardAmount
      }
    });

    // Emit socket update
    if (global.io) {
      global.io.emit("adClickReward", {
        userId,
        adId,
        amount: rewardAmount,
        timestamp: new Date()
      });
    }

    return res.json({
      success: true,
      rewarded: true,
      amount: rewardAmount,
      message: "Ad click reward processed."
    });

  } catch (err) {
    console.error("❌ Error rewarding ad click:", err);
    return res.status(500).json({
      success: false,
      error: "Server error rewarding ad click"
    });
  }
};

const path = require('path');
const fs = require('fs');

exports.createAd = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("role roleName").lean();
    const normalizedRole = String(
      user?.roleName ||
      req.user?.roleName ||
      user?.role?.name ||
      req.user?.role?.name ||
      user?.role ||
      req.user?.role ||
      ""
    ).trim().toLowerCase().replace(/\s+/g, "_");

    const allowedRoles = new Set([
      "moderator",
      "developer",
      "junior_developer",
      "senior_developer"
    ]);

    if (!allowedRoles.has(normalizedRole)) {
      return res.status(403).json({
        success: false,
        message: "Only moderators and developers can create sponsored ads."
      });
    }

    if (!req.body) {
      console.warn("⚠️ createAd missing parsed body", {
        contentType: req.headers["content-type"],
        hasFiles: Boolean(req.files),
        fileFields: req.files ? Object.keys(req.files) : []
      });

      return res.status(400).json({
        success: false,
        message: "Request body is missing. Send multipart/form-data with title and media fields."
      });
    }

    const {
      title,
      ctaText,
      ctaUrl,
      rewardAmount,
      rewardYKC,
      adType,
      scope,
      communityScope
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const adData = {
      title,
      rewardYKC: Number(rewardAmount || rewardYKC) || 5,
      sponsorId: userId,
      adType: adType || 'sponsor',
      isActive: true,
      meta: {
        ctaText,
        ctaUrl,
        scope: scope || "global",
        communityScope: communityScope || "all"
      }
    };

    // files come from multer
    const imageFile = req.files?.image?.[0] || req.files?.imageUrl?.[0];
    const videoFile = req.files?.video?.[0] || req.files?.videoUrl?.[0] || req.files?.media?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0] || req.files?.customThumbnail?.[0];

    if (imageFile) {
      adData.imageUrl = `/uploads/${imageFile.filename}`;
    }

    if (videoFile) {
      adData.videoUrl = `/uploads/${videoFile.filename}`;
    }

    if (thumbnailFile) {
      adData.meta.thumbnail = `/uploads/${thumbnailFile.filename}`;
    }

    if (!adData.imageUrl && !adData.videoUrl) {
      return res.status(400).json({
        success: false,
        message: "Select an image or video for the ad"
      });
    }

    const ad = await Ad.create(adData);

    return res.json({
      success: true,
      ad
    });

  } catch (err) {
    console.error('❌ createAd error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create ad'
    });
  }
};


// POST /ads/reward/:adId  (idempotent — will only reward once per ad view per user)
exports.rewardAd = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.params;
    const { adViewId } = req.body; // recommended (returned from recordAdView)

    // 1) verify ad & adView
    const ad = await Ad.findById(adId);
    if(!ad) return res.status(404).json({ success:false, message:'Ad not found' });

    const adView = await AdView.findById(adViewId);
    if(!adView || String(adView.userId) !== String(userId)) {
      return res.status(400).json({ success:false, message:'Invalid ad view' });
    }

    if(!adView.fullyWatched) return res.status(400).json({ success:false, message:'Ad not fully watched' });

    if(adView.rewarded) {
      return res.status(409).json({ success:false, message:'Already rewarded' });
    }

    // 2) mark rewarded and create transaction atomically
    adView.rewarded = true;
    await adView.save();

    const tx = new RewardTx({
      userId,
      type: "AD_REWARD",
      amount: ad.rewardYKC || 5,
      adId: ad._id,
      meta: { note:'reward for watching ad' }
    });
    await tx.save();

    // credit user's wallet/coins (implement your existing wallet update)
    await User.findByIdAndUpdate(userId, { $inc: { coins: tx.amount } });

    const rewardMessage = `You earned ${tx.amount} YKC for watching an ad.`;
    await sendNotification({
      type: "reward",
      senderId: SYSTEM_USER_ID,
      receiverId: userId,
      activityId: tx._id.toString(),
      targetType: "wallet",
      targetId: tx._id.toString(),
      message: rewardMessage,
      push: true,
      pushTitle: "Reward earned",
      pushBody: rewardMessage,
      pushData: {
        transactionId: tx._id.toString(),
        rewardType: tx.type,
        amount: tx.amount
      }
    });

    // Count fully watched in-app video ads in the verification dashboard.
    const AppVerification = require('../models/appverification.model');
    let av = await AppVerification.findOne({ userId });
    if (!av) {
      av = new AppVerification({ userId });
    }
    if(av && !adView.verificationCounted){
      await av.trackAdView();
      adView.verificationCounted = true;
      await adView.save();
    }

    return res.json({ success:true, rewarded: true, amount: tx.amount });
  } catch(err){ console.error(err); res.status(500).json({ success:false }); }
  
};
