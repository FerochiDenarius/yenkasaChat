// controllers/appVerification.controller.js
const AppVerification = require("../models/appverification.model");
const User = require("../models/user.model");
const auth = require('../middleware/auth');
const { getUserPerformanceMetrics } = require("../services/userPerformanceMetrics");


// ensure all metrics are integers
function sanitizeMetrics(metrics) {
  const out = metrics?.toObject ? metrics.toObject() : { ...(metrics || {}) };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "number") {
      out[k] = Math.floor(out[k]);
    } else if (out[k] == null) {
      out[k] = 0;
    }
  }
  return out;
}

// normalize phase history for frontend
function formatPhaseHistory(history) {
  return history.map(item => ({
    phase: item.phase,
    startedAt: item.startedAt ? item.startedAt.toISOString() : null,
    endedAt: item.endedAt ? item.endedAt.toISOString() : null,
    completed: item.completed ?? false
  }));
}

async function syncVerificationMetrics(appVerification, user) {
  if (!appVerification || !user) return appVerification;

  await appVerification.updateAccountAge(user.createdAt);

  const lifetime = await getUserPerformanceMetrics(user._id);
  const metrics = appVerification.metrics;

  metrics.postsCreated = lifetime.postsCreated || 0;
  metrics.totalPostCount = lifetime.totalPostCount || lifetime.postsCreated || 0;

  metrics.totalFollowers = lifetime.totalFollowers || lifetime.followers || 0;
  metrics.totalFollowing = lifetime.totalFollowing || 0;

  metrics.totalLikesReceived = lifetime.totalLikesReceived || lifetime.likesReceived || 0;
  metrics.maxLikesOnPost = lifetime.maxLikesOnPost || 0;
  metrics.totalLikesCount = lifetime.totalLikesCount || 0;

  metrics.totalViewsReceived = lifetime.totalViewsReceived || lifetime.viewsReceived || 0;
  metrics.totalViewsCount = lifetime.totalViewsCount || 0;

  metrics.totalComments = lifetime.totalComments || lifetime.commentsMade || 0;
  metrics.totalCommentsMade = lifetime.totalCommentsMade || lifetime.commentsMade || 0;
  metrics.totalCommentsReceived = lifetime.totalCommentsReceived || lifetime.commentsReceived || 0;
  metrics.totalRepliesReceived = lifetime.totalRepliesReceived || lifetime.repliesReceived || 0;
  metrics.commentLikesReceived = lifetime.commentLikesReceived || 0;
  metrics.totalShares = lifetime.totalShares || 0;

  appVerification.metrics = sanitizeMetrics(metrics);
  await appVerification.save();
  return appVerification;
}

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

    await syncVerificationMetrics(appVerification, user);

    const requirements = appVerification.getCurrentRequirements();
    const progress = appVerification.checkRequirementsMet();
    const now = new Date();

    const daysRemaining = Math.max(
      0,
      Math.ceil((appVerification.phaseEndDate - now) / (1000 * 60 * 60 * 24))
    );

    return res.json({
      detailsVerification: {
        email: user.emailVerified || false,
        phone: user.phoneVerified || false,
        basicPostingEnabled: user.verified || false,
        userRole: user.role
      },

      appVerification: {
        currentPhase: appVerification.currentPhase,
        hasVerifiedBanner: appVerification.hasVerifiedBanner,
        phaseStartDate: appVerification.phaseStartDate?.toISOString(),
        phaseEndDate: appVerification.phaseEndDate?.toISOString(),
        daysRemaining,
        requirements,
        currentMetrics: sanitizeMetrics(appVerification.metrics),
        progress,
        phaseHistory: formatPhaseHistory(appVerification.phaseHistory)
      }
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
      adsViewed: appVerification.metrics.adsViewed
    });

  } catch (err) {
    console.error("❌ Failed to track ad view:", err);
    return res.status(500).json({ error: "Failed to track ad view" });
  }
};

// ===============================
// UPDATE METRICS
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

    const m = appVerification.metrics;

    switch (type) {

      case "comment":
        m.totalComments += 1;
        m.totalCommentsMade += 1;
        break;

      case "follower":
        m.totalFollowers += value || 1;
        break;

      case "maxLikes":
        if (value > m.maxLikesOnPost) {
          m.maxLikesOnPost = value;
        }
        m.totalLikesCount += value || 0;
        break;

      case "postCreated":
        m.postsCreated += 1;
        m.totalPostCount += 1;
        break;

      case "viewReceived":
        m.totalViewsReceived += 1;
        m.totalViewsCount += 1;
        break;

      case "replyReceived":
        m.totalRepliesReceived += 1;
        break;

      case "commentReceived":
        m.totalCommentsReceived += 1;
        break;

      case "likeOnComment":
        m.commentLikesReceived += 1;
        m.totalLikesCount += 1;
        break;

      case "share":
        m.totalShares += 1;
        break;

      default:
        return res.status(400).json({ error: "Invalid metric type" });
    }

    // sanitize + save
    appVerification.metrics = sanitizeMetrics(m);
    await appVerification.save();

    return res.json({
      success: true,
      metrics: sanitizeMetrics(appVerification.metrics),
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

    await syncVerificationMetrics(appVerification, user);

    const reqs = appVerification.getCurrentRequirements();
    const metrics = sanitizeMetrics(appVerification.metrics);

    function pct(value, reqValue) {
      return reqValue === 0 ? 0 : Math.min(100, (value / reqValue) * 100);
    }

    const detailed = {
      accountAge: pct(metrics.accountAge, reqs.accountAge),
      comments: pct(metrics.totalComments, reqs.comments),
      followers: pct(metrics.totalFollowers, reqs.followers),
      maxLikes: pct(metrics.maxLikesOnPost, reqs.maxLikes),
      dailyLogins: pct(metrics.dailyLogins, reqs.dailyLogins),
      adsViewed: pct(metrics.adsViewed, reqs.adsViewed),
    };

    const avg =
      (detailed.accountAge +
        detailed.comments +
        detailed.followers +
        detailed.maxLikes +
        detailed.dailyLogins +
        detailed.adsViewed) / 6;

    return res.json({
      phase: appVerification.currentPhase,
      overallProgress: Math.round(avg),
      detailedProgress: detailed,
      requirements: reqs,
      currentMetrics: metrics,
    });

  } catch (err) {
    console.error("❌ Failed to fetch progress:", err);
    return res.status(500).json({ error: "Failed to fetch progress" });
  }
};

// ===============================
// CHECK PHASE ADVANCEMENT
// ===============================
exports.checkPhaseAdvancement = async (req, res) => {
  try {
    const userId = req.user.id;

    let appVerification = await AppVerification.findOne({ userId });
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    const user = await User.findById(userId).select("createdAt");
    await syncVerificationMetrics(appVerification, user);

    const result = await appVerification.checkPhaseAdvancement();

    return res.json({
      success: true,
      message: "Phase advancement processed",
      result
    });

  } catch (err) {
    console.error("❌ Failed to check phase advancement:", err);
    return res.status(500).json({ error: "Failed to check phase advancement" });
  }
};
