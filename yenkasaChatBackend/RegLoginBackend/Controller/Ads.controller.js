const Ad = require('../models/Ad.model');
const AdView = require('../models/AdView.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');
const RewardTx = require('../models/Rewards.Transaction.model');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const mediaStorage = require('../services/mediaStorage.service');
const { SYSTEM_USER_ID } = require('../config/system');
const { sendNotification } = require('../services/notification.service');
const rewardService = require('../services/reward.service');
const { canApproveContent, canCreateAd, getPermissions, REVIEWER_RANKS } = require('../middleware/permissions');
const {
  resolveRewardCountry,
  recordRegionalRewardDaily
} = require('../services/regionalRewards.service');
const {
  upsertMonetizationDailyMetrics
} = require('../services/monetizationAnalytics.service');

const AD_REVIEWER_ROLES = new Set(REVIEWER_RANKS.map((rank) => rank.toLowerCase()));
const AD_REVIEWER_ACCESS_ROLES = [...REVIEWER_RANKS];
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

function canReviewAds(user) {
  return canApproveContent(user);
}

function canCreateAds(user) {
  return canCreateAd(user);
}

function resolvePublicBaseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
}

function getLocalUploadInfo(value) {
  if (!value || typeof value !== 'string') {
    return { isLocalUpload: false, path: null };
  }

  let pathname = '';
  try {
    pathname = new URL(value, 'http://local').pathname;
  } catch (err) {
    return { isLocalUpload: false, path: null };
  }

  const marker = '/uploads/';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) {
    return { isLocalUpload: false, path: null };
  }

  let relativePath = '';
  try {
    relativePath = decodeURIComponent(pathname.slice(markerIndex + marker.length));
  } catch (err) {
    return { isLocalUpload: true, path: null };
  }
  const resolvedPath = path.resolve(UPLOADS_DIR, relativePath);
  const insideUploads = resolvedPath === UPLOADS_DIR || resolvedPath.startsWith(`${UPLOADS_DIR}${path.sep}`);

  return {
    isLocalUpload: true,
    path: insideUploads ? resolvedPath : null
  };
}

function sanitizeAdMediaUrl(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url || url === 'null' || url === 'undefined') return null;

  const uploadInfo = getLocalUploadInfo(url);
  if (!uploadInfo.isLocalUpload) return url;

  if (uploadInfo.path && fs.existsSync(uploadInfo.path)) {
    return url;
  }

  return null;
}

function normalizeAdForClient(ad) {
  if (!ad) return ad;

  const meta = ad.meta || {};
  const imageUrl = sanitizeAdMediaUrl(ad.imageUrl);
  const videoUrl = sanitizeAdMediaUrl(ad.videoUrl);
  const thumbnailUrl = sanitizeAdMediaUrl(ad.thumbnailUrl || meta.thumbnail || meta.thumbnailUrl);

  return {
    ...ad,
    imageUrl,
    videoUrl,
    thumbnailUrl,
    ctaText: ad.ctaText || meta.ctaText || null,
    ctaUrl: ad.ctaUrl || meta.ctaUrl || null,
    sponsorName: ad.sponsorName || meta.sponsorName || null
  };
}

function hasRenderableAdMedia(ad) {
  if (!ad) return false;
  return Boolean(ad.imageUrl || ad.videoUrl);
}

function publicAdFilter() {
  return {
    isActive: true,
    approvalStatus: "approved",
    adType: { $in: ["sponsor", "internal"] }
  };
}

async function getAdReviewers() {
  return User.find({
    $or: [
      { roleName: { $in: Array.from(AD_REVIEWER_ROLES) } },
      { accessRole: { $in: AD_REVIEWER_ACCESS_ROLES } }
    ]
  }).select("_id username playerId");
}

async function loadAdForClient(adId) {
  return Ad.findById(adId)
    .populate("submittedBy", "username profileImage verified roleName")
    .lean();
}


// GET /ads/feed?page=&limit=
exports.getAdsFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page-1)*limit;

    const ads = await Ad.find(publicAdFilter())
      .populate("submittedBy", "username profileImage verified roleName")
      .sort({ impressions: 1, createdAt: -1 })
      .skip(skip)
      .limit(Math.min(limit * 3, 50))
      .lean();
    const renderableAds = ads
      .map(normalizeAdForClient)
      .filter(hasRenderableAdMedia)
      .slice(0, limit);
    res.json({ success:true, ads: renderableAds });
  } catch(err){ res.status(500).json({ success:false, err: err.message }); }
};

// POST /ads/view/:adId  (called after the ad finishes; include duration + fullyWatched boolean)
exports.recordAdView = async (req, res) => {
  try {
    const userId = req.user.id;
    const { adId } = req.params;
    const { durationMs = 0, fullyWatched = false, deviceInfo = {} } = req.body;
    const userCountry = resolveRewardCountry(req.user);

    const ad = await Ad.findOne({ _id: adId, ...publicAdFilter() });
    if(!ad) return res.status(404).json({ success:false, message:'Ad not found' });

    const adView = new AdView({ adId, userId, durationMs, fullyWatched, deviceInfo });
    await adView.save();

    await recordRegionalRewardDaily({
      country: userCountry.country,
      platform: 'android',
      impressions: 1,
      requests: 1,
      verifiedCountry: req.user?.verifiedCountry || '',
      detectedCountry: req.user?.detectedCountry || '',
      countryConfidence: req.user?.countryConfidence || userCountry.confidence,
      metadata: {
        event: 'ad_view',
        adId: adId.toString(),
        fullyWatched: Boolean(fullyWatched)
      }
    });

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
    const ad = await Ad.findOne({ _id: adId, ...publicAdFilter() }).select("_id");

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found"
      });
    }

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

    const coinTx = await rewardService.reward(userId, rewardAmount, {
      type: "REWARD_VIEWS",
      description: `Earned ${rewardAmount} YKC for clicking an ad`,
      activityId: `ad_click_${adId}_${userId}`
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
      newBalance: coinTx?.toUserBalanceAfter ?? null,
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

exports.trackMonetizationEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId)
      .select('verifiedCountry detectedCountry countryConfidence role roleName accessRole username')
      .lean();
    let creatorUserId = '';
    const postId = req.body?.postId?.toString();
    if (postId && mongoose.Types.ObjectId.isValid(postId)) {
      const post = await Post.findById(postId).select('userId').lean();
      creatorUserId = post?.userId?.toString() || '';
    }

    const payload = {
      ...req.body,
      platform: req.body?.platform || 'android',
      creatorUserId
    };

    const saved = await upsertMonetizationDailyMetrics(payload, user);

    return res.json({
      success: true,
      metrics: saved,
      message: 'Monetization event tracked.'
    });
  } catch (err) {
    console.error('❌ Failed to track monetization event:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to track monetization event'
    });
  }
};

exports.createAd = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId)
      .select("role roleName accessRole verified username")
      .populate("role", "role name accessRole roleName")
      .lean();
    const permissions = getPermissions(user || req.user);
    const normalizedRole = permissions.rank.toLowerCase();

    if (!canCreateAds(user)) {
      return res.status(403).json({
        success: false,
        message: "Only verified users and approved reviewer roles can create sponsored ads."
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

   const finalAdType = (adType || "sponsor").toLowerCase();

const autoApprove = canReviewAds(user || req.user);

const adData = {
  title,
  rewardYKC: Number(rewardAmount || rewardYKC) || 5,
  sponsorId: userId,
  adType: finalAdType,
  isActive: autoApprove,
  approvalStatus: autoApprove ? "approved" : "pending",
  submittedBy: userId,
  submittedByRole: normalizedRole,
  ctaText: ctaText || "",
  ctaUrl: ctaUrl || "",
  sponsorName: user?.username || "Yenkasa Sponsor",
  meta: {
    ctaText,
    ctaUrl,
    scope: scope || "global",
    communityScope: communityScope || "all",
    sponsorName: user?.username || "Yenkasa Sponsor"
  }
};

    // files come from multer
    const imageFile = req.files?.image?.[0] || req.files?.imageUrl?.[0];
    const videoFile = req.files?.video?.[0] || req.files?.videoUrl?.[0] || req.files?.media?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0] || req.files?.customThumbnail?.[0];

if (imageFile) {
  const result = await mediaStorage.upload(imageFile, {
    folder: 'posts',
    type: 'image',
    area: 'ad_image',
    prefix: 'ad-image',
  });
  adData.imageUrl = result.secure_url;
}

if (videoFile) {
  const result = await mediaStorage.upload(videoFile, {
    folder: 'videos',
    type: 'video',
    area: 'ad_video',
    prefix: 'ad-video',
  });
  adData.videoUrl = result.secure_url;
}

if (thumbnailFile) {
  const result = await mediaStorage.upload(thumbnailFile, {
    folder: 'posts',
    type: 'image',
    area: 'ad_thumbnail',
    prefix: 'ad-thumbnail',
  });
  adData.thumbnailUrl = result.secure_url;
  adData.meta.thumbnail = adData.thumbnailUrl;
}

// Google AdMob ads are handled only by the Android SDK.
if (finalAdType === "google") {
  return res.status(400).json({
    success: false,
    message: "Google AdMob ads are managed by the Android SDK and should not be created through this upload API."
  });
}

if (!adData.imageUrl && !adData.videoUrl) {
  return res.status(400).json({
    success: false,
    message: "Select an image or video for the ad"
  });
}

    const ad = await Ad.create(adData);

    if (!autoApprove) {
      const reviewers = await getAdReviewers();
      for (const reviewer of reviewers) {
        if (String(reviewer._id) === String(userId)) continue;
        await sendNotification({
          type: "ad_pending",
          senderId: userId,
          receiverId: reviewer._id,
          activityId: `ad_pending_${ad._id}`,
          targetType: "ad",
          targetId: ad._id.toString(),
          message: "A new sponsored ad is awaiting approval.",
          push: true,
          pushTitle: "Pending Sponsored Ad",
          pushBody: "A new sponsored ad is waiting for approval.",
          pushData: { adId: ad._id.toString() }
        });
      }
    }

    const hydratedAd = await loadAdForClient(ad._id);

    return res.json({
      success: true,
      message: autoApprove ? "Ad created and approved successfully." : "Ad submitted for approval.",
      adId: ad._id.toString(),
      ad: normalizeAdForClient(hydratedAd || ad.toObject())
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
    const ad = await Ad.findOne({ _id: adId, ...publicAdFilter() });
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

    const coinTx = await rewardService.reward(userId, tx.amount, {
      type: "REWARD_VIEWS",
      description: `Earned ${tx.amount} YKC for watching an ad`,
      activityId: `ad_watch_${adId}_${adViewId}`,
    });

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

    // Verification adsViewed is incremented once by rewardService for REWARD_VIEWS.
    if (!adView.verificationCounted) {
      adView.verificationCounted = true;
      await adView.save();
    }

    return res.json({
      success: true,
      rewarded: true,
      amount: tx.amount,
      newBalance: coinTx?.toUserBalanceAfter ?? null
    });
  } catch(err){ console.error(err); res.status(500).json({ success:false }); }
  
};

exports.getPendingAds = async (req, res) => {
  try {
    if (!canReviewAds(req.user)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const ads = await Ad.find({ approvalStatus: "pending" })
      .populate("submittedBy", "username profileImage verified roleName")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, ads: ads.map(normalizeAdForClient) });
  } catch (err) {
    console.error("❌ Failed to fetch pending ads:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch pending ads" });
  }
};

exports.approveAd = async (req, res) => {
  try {
    if (!canReviewAds(req.user)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const ad = await Ad.findById(req.params.adId);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    if (String(ad.submittedBy) === String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You cannot approve your own ad." });
    }

    ad.approvalStatus = "approved";
    ad.isActive = true;
    ad.approvedBy = req.user.id;
    ad.approvedAt = new Date();
    ad.rejectedBy = null;
    ad.rejectedAt = null;
    ad.rejectionReason = "";
    await ad.save();

    const owner = await User.findById(ad.submittedBy).select("_id playerId");
    if (owner) {
      await sendNotification({
        type: "ad_approved",
        senderId: req.user.id,
        receiverId: owner._id,
        activityId: `ad_approved_${ad._id}`,
        targetType: "ad",
        targetId: ad._id.toString(),
        message: "Your sponsored ad has been approved and is now live.",
        push: true,
        pushTitle: "Ad Approved",
        pushBody: "Your sponsored ad is now live.",
        pushData: { adId: ad._id.toString() }
      });
    }

    const hydratedAd = await loadAdForClient(ad._id);
    return res.json({ success: true, ad: normalizeAdForClient(hydratedAd || ad.toObject()) });
  } catch (err) {
    console.error("❌ Failed to approve ad:", err);
    return res.status(500).json({ success: false, message: "Failed to approve ad" });
  }
};

exports.rejectAd = async (req, res) => {
  try {
    if (!canReviewAds(req.user)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const ad = await Ad.findById(req.params.adId);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    if (String(ad.submittedBy) === String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You cannot reject your own ad." });
    }

    ad.approvalStatus = "rejected";
    ad.isActive = false;
    ad.rejectedBy = req.user.id;
    ad.rejectedAt = new Date();
    ad.rejectionReason = String(req.body?.reason || "").trim();
    ad.approvedBy = null;
    ad.approvedAt = null;
    await ad.save();

    const owner = await User.findById(ad.submittedBy).select("_id playerId");
    if (owner) {
      await sendNotification({
        type: "ad_rejected",
        senderId: req.user.id,
        receiverId: owner._id,
        activityId: `ad_rejected_${ad._id}`,
        targetType: "ad",
        targetId: ad._id.toString(),
        message: ad.rejectionReason
          ? `Your sponsored ad was rejected: ${ad.rejectionReason}`
          : "Your sponsored ad was rejected.",
        push: true,
        pushTitle: "Ad Rejected",
        pushBody: ad.rejectionReason
          ? `Reason: ${ad.rejectionReason}`
          : "Your sponsored ad was rejected.",
        pushData: { adId: ad._id.toString() }
      });
    }

    const hydratedAd = await loadAdForClient(ad._id);
    return res.json({ success: true, ad: normalizeAdForClient(hydratedAd || ad.toObject()) });
  } catch (err) {
    console.error("❌ Failed to reject ad:", err);
    return res.status(500).json({ success: false, message: "Failed to reject ad" });
  }
};

exports.getMyAds = async (req, res) => {
  try {
    const ads = await Ad.find({ submittedBy: req.user.id })
      .populate("submittedBy", "username profileImage verified roleName")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, ads: ads.map(normalizeAdForClient) });
  } catch (err) {
    console.error("❌ Failed to fetch my ads:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch my ads" });
  }
};
