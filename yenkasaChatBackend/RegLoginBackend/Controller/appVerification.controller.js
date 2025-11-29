// controllers/appVerification.controller.js
const AppVerification = require("../models/appverification.model");
const User = require("../models/user.model");

// ===============================
// GET DASHBOARD
// ===============================
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select(
      "verified emailVerified phoneVerified createdAt role"
    );

    let appVerification = await AppVerification.findOne({ userId });
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    await appVerification.updateAccountAge(user.createdAt);

    const requirements = appVerification.getCurrentRequirements();
    const progress = appVerification.checkRequirementsMet();
    const now = new Date();
    const daysRemaining = Math.ceil(
      (appVerification.phaseEndDate - now) / (1000 * 60 * 60 * 24)
    );

    return res.json({
      detailsVerification: {
        email: user.emailVerified || false,
        phone: user.phoneVerified || false,
        basicPostingEnabled: user.verified || false,
        userRole: user.role,
      },

      appVerification: {
        currentPhase: appVerification.currentPhase,
        hasVerifiedBanner: appVerification.hasVerifiedBanner,
        phaseStartDate: appVerification.phaseStartDate,
        phaseEndDate: appVerification.phaseEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        requirements,
        currentMetrics: appVerification.metrics, // now includes ALL metrics
        progress,
        phaseHistory: appVerification.phaseHistory,
      },
    });
  } catch (err) {
    console.error("❌ Failed to fetch verification dashboard:", err);
    return res.status(500).json({ error: "Failed to fetch verification dashboard" });
  }
};

// ===============================
// TRACK LOGIN
// ===============================
exports.trackLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    let appVerification = await AppVerification.findOne({ userId });

    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    const wasNewDay = await appVerification.trackLogin();

    return res.json({
      success: true,
      newDayLogged: wasNewDay,
      dailyLogins: appVerification.metrics.dailyLogins,
    });
  } catch (err) {
    console.error("❌ Failed to track login:", err);
    return res.status(500).json({ error: "Failed to track login" });
  }
};

// ===============================
// TRACK AD VIEW
// ===============================
exports.trackAdView = async (req, res) => {
  try {
    const userId = req.user.id;
    let appVerification = await AppVerification.findOne({ userId });

    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    await appVerification.trackAdView();

    return res.json({
      success: true,
      adsViewed: appVerification.metrics.adsViewed,
    });
  } catch (err) {
    console.error("❌ Failed to track ad view:", err);
    return res.status(500).json({ error: "Failed to track ad view" });
  }
};

// ===============================
// UPDATE METRIC (comment/follower/like)
// ===============================
exports.updateMetrics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, value } = req.body;

    let appVerification = await AppVerification.findOne({ userId });
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    switch (type) {
      case "comment":
        appVerification.metrics.totalComments += 1;
        break;

      case "follower":
        appVerification.metrics.totalFollowers += value || 1;
        break;

      case "maxLikes":
        if (value > appVerification.metrics.maxLikesOnPost) {
          appVerification.metrics.maxLikesOnPost = value;
        }
        break;

      // NEW — FULL METRICS SUPPORT
      case "postCreated":
        appVerification.metrics.postsCreated += 1;
        break;

      case "viewReceived":
        appVerification.metrics.viewsReceived += 1;
        break;

      case "replyReceived":
        appVerification.metrics.repliesReceived += 1;
        break;

      default:
        return res.status(400).json({ error: "Invalid metric type" });
    }

    await appVerification.save();

    return res.json({
      success: true,
      metrics: appVerification.metrics,
    });
  } catch (err) {
    console.error("❌ Failed to update metrics:", err);
    return res.status(500).json({ error: "Failed to update metrics" });
  }
};

// ===============================
// GET PROGRESS SUMMARY
// ===============================
exports.getProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const appVerification = await AppVerification.findOne({ userId });

    if (!appVerification) {
      return res.json({ progress: 0, phase: 1 });
    }

    await appVerification.updateAccountAge(user.createdAt);

    const requirements = appVerification.getCurrentRequirements();
    const metrics = appVerification.metrics;

    const percentages = {
      accountAge: Math.min(100, (metrics.accountAge / requirements.accountAge) * 100),
      comments: Math.min(100, (metrics.totalComments / requirements.comments) * 100),
      followers: Math.min(100, (metrics.totalFollowers / requirements.followers) * 100),
      maxLikes: Math.min(100, (metrics.maxLikesOnPost / requirements.maxLikes) * 100),
      dailyLogins: Math.min(100, (metrics.dailyLogins / requirements.dailyLogins) * 100),
      adsViewed: Math.min(100, (metrics.adsViewed / requirements.adsViewed) * 100),
    };

    const overallProgress =
      Object.values(percentages).reduce((a, b) => a + b, 0) / Object.keys(percentages).length;

    return res.json({
      phase: appVerification.currentPhase,
      overallProgress: Math.round(overallProgress),
      detailedProgress: percentages,
      requirements,
      currentMetrics: metrics,
    });
  } catch (err) {
    console.error("❌ Failed to fetch progress:", err);
    return res.status(500).json({ error: "Failed to fetch progress" });
  }
};
