// controllers/appVerification.controller.js
const AppVerification = require("../models/appverification.model");
const User = require("../models/user.model");
const { getUserPerformanceMetrics } = require("../services/userPerformanceMetrics");
const {
  buildRankSummary,
  isPhaseActive,
  normalizeMetrics,
  splitMetrics,
  syncUserRole,
} = require("../services/ranking.service");
const { auditSecurityEvent } = require("../utils/securityAudit");


// ensure all metrics are integers
function sanitizeMetrics(metrics) {
  return normalizeMetrics(metrics);
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
metrics.totalLikesCount = Math.max(
  Number(metrics.totalLikesCount || 0),
  Number(lifetime.totalLikesCount || 0)
);
metrics.postsLiked = Math.max(
  Number(metrics.postsLiked || 0),
  Number(lifetime.postsLiked || 0)
);

  metrics.totalViewsReceived = lifetime.totalViewsReceived || lifetime.viewsReceived || 0;
  metrics.totalViewsCount = lifetime.totalViewsCount || 0;
  metrics.totalViewsMade = lifetime.totalViewsMade || 0;

  metrics.totalComments = lifetime.totalComments || lifetime.commentsMade || 0;
  metrics.totalCommentsMade = lifetime.totalCommentsMade || lifetime.commentsMade || 0;
  metrics.repliesMade = lifetime.repliesMade || 0;
  metrics.totalCommentsReceived = lifetime.totalCommentsReceived || lifetime.commentsReceived || 0;
  metrics.totalRepliesReceived = lifetime.totalRepliesReceived || lifetime.repliesReceived || 0;
  metrics.commentLikesReceived = lifetime.commentLikesReceived || 0;
  metrics.totalShares = lifetime.totalShares || 0;

  metrics.sharesMade = lifetime.sharesMade || 0;
metrics.profilesVisited = lifetime.profilesVisited || 0;
metrics.communitiesJoined = lifetime.communitiesJoined || 0;
metrics.communitiesEngaged = lifetime.communitiesEngaged || 0;
metrics.reportsMade = lifetime.reportsMade || 0;
metrics.validReports = lifetime.validReports || 0;

  appVerification.metrics = sanitizeMetrics(metrics);
  await appVerification.save();
  await syncUserRole(user, appVerification.metrics);
  return appVerification;
}

// ===============================
// GET DASHBOARD
// ===============================
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "verified emailVerified phoneVerified createdAt role roleName"
    );

    let appVerification = await AppVerification.findOne({ userId });

    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    await syncVerificationMetrics(appVerification, user);

    const effectiveRole = user.roleName || user.role?.role || user.role;
    const rankSummary = buildRankSummary(appVerification.metrics, effectiveRole);
    const metricGroups = splitMetrics(appVerification.metrics);
    const currentMetrics = sanitizeMetrics(appVerification.metrics);
    const phaseActive = isPhaseActive();

    return res.json({
      detailsVerification: {
        email: user.emailVerified || false,
        phone: user.phoneVerified || false,
        basicPostingEnabled: user.verified || false,
        userRole: user.roleName || user.role?.role || "unverified"
      },

      appVerification: {
        currentPhase: phaseActive ? appVerification.currentPhase : null,
        currentRank: rankSummary.currentRank,
        currentRankKey: rankSummary.currentRank,
        nextRank: rankSummary.nextRank,
        nextRankKey: rankSummary.nextRank,
        progressToNextRank: rankSummary.progressToNextRank,
        rankingPeriodStatus: rankSummary.rankingPeriodStatus,
        rankingPeriodLabel: rankSummary.rankingPeriodLabel,
        officialPhaseStartDate: rankSummary.officialPhaseStartDate,
        rankingLaunchDate: rankSummary.officialPhaseStartDate,
        hasVerifiedBanner: appVerification.hasVerifiedBanner,
        phaseStartDate: phaseActive ? appVerification.phaseStartDate?.toISOString() : null,
        phaseEndDate: phaseActive ? appVerification.phaseEndDate?.toISOString() : null,
        daysRemaining: phaseActive
          ? Math.max(
              0,
              Math.ceil((appVerification.phaseEndDate - new Date()) / (1000 * 60 * 60 * 24))
            )
          : null,
        requirements: rankSummary.requirements,
        currentMetrics,
        progress: rankSummary.progress,
        phaseHistory: formatPhaseHistory(appVerification.phaseHistory),
        activityMetrics: metricGroups.activityMetrics,
        performanceMetrics: metricGroups.performanceMetrics,
        activeRankingMetrics: metricGroups.activityMetrics,
        analyticsOnlyMetrics: metricGroups.performanceMetrics,
      },
      userRole: rankSummary.currentRank,
      performanceMetrics: metricGroups.performanceMetrics,
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
    const user = await User.findById(userId).select("createdAt role roleName");

    let appVerification = await AppVerification.findOne({ userId });
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    auditSecurityEvent("client_ad_metric_increment_blocked", req, {
      reason: "adsViewed is counted only after a verified ad reward/impression event"
    });

    await syncVerificationMetrics(appVerification, user);

    return res.json({
      success: true,
      trustedMetricsOnly: true,
      message: "Ad verification progress is updated after a verified ad view is completed.",
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
    const user = await User.findById(userId).select("createdAt role roleName");

    let appVerification = await AppVerification.findOne({ userId });
    if (!appVerification) {
      appVerification = new AppVerification({ userId });
      await appVerification.save();
    }

    auditSecurityEvent("client_verification_metric_update_blocked", req, {
      reason: "verification metrics are derived from trusted backend events only",
      requestedType: req.body?.type || req.body?.metricType || null,
      requestedValue: req.body?.value ?? req.body?.amount ?? req.body?.increment ?? null
    });

    await syncVerificationMetrics(appVerification, user);

    return res.json({
      success: true,
      trustedMetricsOnly: true,
      message: "Verification progress was refreshed from trusted Yenkasa activity.",
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

    const user = await User.findById(userId).select("createdAt role roleName");
    const appVerification = await AppVerification.findOne({ userId });

    if (!appVerification) {
      return res.json({ progress: 0, phase: 1 });
    }

    await syncVerificationMetrics(appVerification, user);

    const rankSummary = buildRankSummary(appVerification.metrics, user.roleName || user.role?.role || user.role);
    const reqs = rankSummary.requirements;
    const metrics = sanitizeMetrics(appVerification.metrics);

    function pct(value, reqValue) {
      return reqValue === 0 ? 0 : Math.min(100, (value / reqValue) * 100);
    }

    const detailed = {
      accountAge: pct(metrics.accountAge, reqs.accountAge),
      commentsMade: pct(metrics.totalCommentsMade, reqs.commentsMade),
      following: pct(metrics.totalFollowing, reqs.following),
      likesGiven: pct(metrics.postsLiked, reqs.likesGiven),
      dailyLogins: pct(metrics.dailyLogins, reqs.dailyLogins),
      adsViewed: pct(metrics.adsViewed, reqs.adsViewed),
      followers: pct(metrics.totalFollowers, reqs.followers),
      commentsReceived: pct(metrics.totalCommentsReceived, reqs.commentsReceived),

      // Backward-compatible aliases.
      comments: pct(metrics.totalCommentsMade, reqs.commentsMade),
      maxLikes: pct(metrics.postsLiked, reqs.likesGiven),
    };

    const avg =
      (detailed.accountAge +
        detailed.commentsMade +
        detailed.following +
        detailed.likesGiven +
        detailed.followers +
        detailed.dailyLogins +
        detailed.adsViewed +
        (reqs.followers > 0 ? detailed.followers : 0) +
        (reqs.commentsReceived > 0 ? detailed.commentsReceived : 0)) /
      (reqs.followers > 0 || reqs.commentsReceived > 0 ? 8 : 6);

    return res.json({
      phase: isPhaseActive() ? appVerification.currentPhase : null,
      currentRank: rankSummary.currentRank,
      nextRank: rankSummary.nextRank,
      overallProgress: rankSummary.progressToNextRank || Math.round(avg),
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

    const user = await User.findById(userId).select("createdAt role roleName");
    await syncVerificationMetrics(appVerification, user);

    if (!isPhaseActive()) {
      return res.json({
        success: false,
        message: "Phase system not active yet",
      });
    }

    const currentRole = user.roleName || user.role?.role || user.role;
    const rankSummary = buildRankSummary(appVerification.metrics, currentRole);
    await syncUserRole(user, appVerification.metrics);

    return res.json({
      success: true,
      message: rankSummary.nextRank
        ? `Ranking status refreshed. Next rank: ${rankSummary.nextRank.replace(/_/g, " ")}`
        : `Ranking status refreshed. You are at the highest available rank.`,
      currentRank: rankSummary.currentRank,
      nextRank: rankSummary.nextRank,
      progressToNextRank: rankSummary.progressToNextRank,
    });

  } catch (err) {
    console.error("❌ Failed to check phase advancement:", err);
    return res.status(500).json({ error: "Failed to check phase advancement" });
  }
};
