const Permission = require("../models/permissions.model");
const {
  ACTIVE_METRIC_KEYS,
  AUTO_RANKS,
  MANUAL_OVERRIDE_ROLES,
  OFFICIAL_LABEL,
  OFFICIAL_PHASE_START_DATE,
  PASSIVE_METRIC_KEYS,
  PRELAUNCH_LABEL,
  RANK_REQUIREMENTS,
} = require("../config/ranking.config");

const LEGACY_ROLE_MAP = Object.freeze({
  user: "unverified",
  developer: "senior_developer",
});

const STAFF_ROLES = Object.freeze([
  "moderator",
  "admin",
  "junior_developer",
  "senior_developer",
]);

function toAccessRole(roleKey) {
  return String(roleKey || "unverified").toUpperCase();
}

function normalizeRole(role) {
  if (!role) return "unverified";

  if (typeof role === "object") {
    return normalizeRole(role.roleName || role.role || role.name);
  }

  const normalized = String(role).trim().toLowerCase().replace(/\s+/g, "_");
  return LEGACY_ROLE_MAP[normalized] || normalized || "unverified";
}

function normalizeMetrics(metrics = {}) {
  const safe = metrics?.toObject ? metrics.toObject() : { ...metrics };
  const normalized = {};

  for (const [key, value] of Object.entries(safe)) {
    normalized[key] = typeof value === "number" ? Math.floor(value) : Number(value || 0);
  }

  for (const key of [...ACTIVE_METRIC_KEYS, ...PASSIVE_METRIC_KEYS]) {
    normalized[key] = Math.max(0, Number(normalized[key] || 0));
  }

  return normalized;
}

function getRequirementsForRank(rank) {
  return RANK_REQUIREMENTS[normalizeRole(rank)] || {};
}

function meetsRank(metricsInput, rank) {
  const metrics = normalizeMetrics(metricsInput);
  const requirements = getRequirementsForRank(rank);
  const keys = Object.keys(requirements);

  if (keys.length === 0) return true;
  return keys.every((key) => metrics[key] >= requirements[key]);
}

function calculateUserRank(metricsInput, userRole) {
  const normalizedRole = normalizeRole(userRole);

  if (MANUAL_OVERRIDE_ROLES.includes(normalizedRole)) {
    return normalizedRole;
  }

  const metrics = normalizeMetrics(metricsInput);
  const orderedChecks = ["moderator", "admin", "legend", "rising_star", "verified"];

  for (const rank of orderedChecks) {
    if (meetsRank(metrics, rank)) return rank;
  }

  return "unverified";
}

function getNextRank(currentRank) {
  const normalized = normalizeRole(currentRank);
  if (MANUAL_OVERRIDE_ROLES.includes(normalized)) return null;

  const index = AUTO_RANKS.indexOf(normalized);
  if (index < 0 || index >= AUTO_RANKS.length - 1) return null;
  return AUTO_RANKS[index + 1];
}

function rankPhaseIndex(rank) {
  const normalized = normalizeRole(rank);
  const manualMap = {
    junior_developer: AUTO_RANKS.indexOf("moderator") + 1,
    senior_developer: AUTO_RANKS.indexOf("moderator") + 1,
  };

  if (manualMap[normalized]) return manualMap[normalized];

  const index = AUTO_RANKS.indexOf(normalized);
  return index >= 0 ? index + 1 : 1;
}

function metricProgress(metricsInput, requirements) {
  const metrics = normalizeMetrics(metricsInput);
  const entries = Object.entries(requirements);
  if (entries.length === 0) return 100;

  const total = entries.reduce((sum, [key, target]) => {
    if (!target || target <= 0) return sum + 100;
    return sum + Math.min(100, Math.round((metrics[key] / target) * 100));
  }, 0);

  return Math.max(0, Math.min(100, Math.round(total / entries.length)));
}

function buildProgressFlags(metricsInput, rank) {
  const metrics = normalizeMetrics(metricsInput);
  const requirements = getRequirementsForRank(rank);

  const progress = {
    accountAge: true,
    commentsMade: true,
    following: true,
    likesGiven: true,
    dailyLogins: true,
    adsViewed: true,
    followers: true,
    commentsReceived: true,
    allMet: true,
  };

  const checks = {
    accountAge: ["accountAge"],
    commentsMade: ["totalCommentsMade"],
    following: ["totalFollowing"],
    likesGiven: ["postsLiked"],
    dailyLogins: ["dailyLogins"],
    adsViewed: ["adsViewed"],
    followers: ["totalFollowers"],
    commentsReceived: ["totalCommentsReceived"],
  };

  for (const [flag, keys] of Object.entries(checks)) {
    const requiredKey = keys[0];
    const requiredValue = requirements[requiredKey];
    const met = requiredValue == null ? true : metrics[requiredKey] >= requiredValue;
    progress[flag] = met;
  }

  progress.allMet = Object.values(progress).every((value) => value === true);
  return progress;
}

function buildRequirementPayload(rank) {
  const requirements = getRequirementsForRank(rank);
  return {
    accountAge: requirements.accountAge || 0,
    commentsMade: requirements.totalCommentsMade || 0,
    following: requirements.totalFollowing || 0,
    likesGiven: requirements.postsLiked || 0,
    dailyLogins: requirements.dailyLogins || 0,
    adsViewed: requirements.adsViewed || 0,
    followers: requirements.totalFollowers || 0,
    commentsReceived: requirements.totalCommentsReceived || 0,

    // Backward-compatible aliases for older Android fields.
    comments: requirements.totalCommentsMade || 0,
    maxLikes: requirements.postsLiked || 0,
  };
}

function splitMetrics(metricsInput) {
  const metrics = normalizeMetrics(metricsInput);
  return {
    activityMetrics: {
      accountAge: metrics.accountAge || 0,
      totalCommentsMade: metrics.totalCommentsMade || 0,
      totalFollowing: metrics.totalFollowing || 0,
      postsLiked: metrics.postsLiked || 0,
      dailyLogins: metrics.dailyLogins || 0,
      adsViewed: metrics.adsViewed || 0,
    },
    performanceMetrics: {
      totalFollowers: metrics.totalFollowers || 0,
      totalCommentsReceived: metrics.totalCommentsReceived || 0,
      totalLikesReceived: metrics.totalLikesReceived || 0,
      totalViewsReceived: metrics.totalViewsReceived || 0,
      maxLikesOnPost: metrics.maxLikesOnPost || 0,
    },
  };
}

function getRankingPeriodStatus(now = new Date()) {
  return now < OFFICIAL_PHASE_START_DATE ? "pre_launch" : "active_phase";
}

function getRankingPeriodLabel(status = getRankingPeriodStatus()) {
  return status === "active_phase" ? OFFICIAL_LABEL : PRELAUNCH_LABEL;
}

function isPhaseActive(now = new Date()) {
  return getRankingPeriodStatus(now) === "active_phase";
}

function buildRankSummary(metricsInput, userRole) {
  const metrics = normalizeMetrics(metricsInput);
  const currentRank = calculateUserRank(metrics, userRole);
  const nextRank = getNextRank(currentRank);

  return {
    currentRank,
    nextRank,
    progressToNextRank: nextRank ? metricProgress(metrics, getRequirementsForRank(nextRank)) : 100,
    rankingPeriodStatus: getRankingPeriodStatus(),
    rankingPeriodLabel: getRankingPeriodLabel(getRankingPeriodStatus()),
    officialPhaseStartDate: OFFICIAL_PHASE_START_DATE.toISOString(),
    currentPhase: rankPhaseIndex(currentRank),
    requirements: buildRequirementPayload(nextRank || currentRank),
    progress: buildProgressFlags(metrics, nextRank || currentRank),
  };
}

async function syncUserRole(user, metricsInput) {
  if (!user) return null;

  const staffRole = normalizeRole(user.staffRole);
  if (STAFF_ROLES.includes(staffRole)) {
    const permissionDoc = await Permission.findOne({ role: staffRole });
    let changed = false;

    if (user.roleName !== staffRole) {
      user.roleName = staffRole;
      changed = true;
    }
    if (user.accessRole !== toAccessRole(staffRole)) {
      user.accessRole = toAccessRole(staffRole);
      changed = true;
    }
    if (permissionDoc && user.role?.toString() !== permissionDoc._id.toString()) {
      user.role = permissionDoc._id;
      changed = true;
    }

    if (changed) await user.save();
    return staffRole;
  }

  const currentRole = normalizeRole(user.roleName || user.role);
  const calculatedRole = calculateUserRank(metricsInput, currentRole);

  if (currentRole === calculatedRole && user.role && MANUAL_OVERRIDE_ROLES.includes(currentRole)) {
    return calculatedRole;
  }

  const permissionRole = Permission.normalize ? Permission.normalize(calculatedRole) : calculatedRole;
  const permissionDoc = await Permission.findOne({ role: permissionRole });

  user.roleName = calculatedRole;
  if (permissionDoc) {
    user.role = permissionDoc._id;
  }
  await user.save();

  return calculatedRole;
}

module.exports = {
  buildRankSummary,
  buildRequirementPayload,
  buildProgressFlags,
  calculateUserRank,
  getNextRank,
  getRankingPeriodLabel,
  getRankingPeriodStatus,
  getRequirementsForRank,
  isPhaseActive,
  metricProgress,
  normalizeMetrics,
  normalizeRole,
  rankPhaseIndex,
  splitMetrics,
  syncUserRole,
};
