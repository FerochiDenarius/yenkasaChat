const OFFICIAL_PHASE_START_DATE = new Date(
  process.env.RANKING_LAUNCH_DATE || "2026-05-25T00:00:00.000Z"
);

const PRELAUNCH_LABEL = "Pre-launch ranking period";
const OFFICIAL_LABEL = "Official ranking period";

const AUTO_RANKS = Object.freeze([
  "unverified",
  "verified",
  "rising_star",
  "legend",
  "admin",
  "moderator",
]);

const MANUAL_OVERRIDE_ROLES = Object.freeze([
  "junior_developer",
  "senior_developer",
]);

const ACTIVE_METRIC_KEYS = Object.freeze([
  "accountAge",
  "totalCommentsMade",
  "totalFollowing",
  "postsLiked",
  "dailyLogins",
  "adsViewed",
]);

const PASSIVE_METRIC_KEYS = Object.freeze([
  "totalFollowers",
  "totalCommentsReceived",
]);

const RANK_REQUIREMENTS = Object.freeze({
  unverified: Object.freeze({}),
  verified: Object.freeze({
    accountAge: 21,
    totalCommentsMade: 45,
    totalFollowing: 21,
    postsLiked: 50,
    dailyLogins: 30,
    adsViewed: 100,
  }),
  rising_star: Object.freeze({
    accountAge: 63,
    totalCommentsMade: 50,
    totalFollowing: 130,
    postsLiked: 200,
    dailyLogins: 42,
    adsViewed: 200,
  }),
  legend: Object.freeze({
    accountAge: 90,
    totalCommentsMade: 150,
    totalFollowing: 200,
    postsLiked: 300,
    dailyLogins: 60,
    adsViewed: 300,
    totalFollowers: 100,
    totalCommentsReceived: 50,
  }),
  admin: Object.freeze({
    accountAge: 150,
    totalCommentsMade: 400,
    totalFollowing: 400,
    postsLiked: 600,
    dailyLogins: 130,
    adsViewed: 700,
    totalFollowers: 200,
    totalCommentsReceived: 200,
  }),
  moderator: Object.freeze({
    accountAge: 225,
    totalCommentsMade: 600,
    totalFollowing: 600,
    postsLiked: 900,
    dailyLogins: 195,
    adsViewed: 1050,
    totalFollowers: 300,
    totalCommentsReceived: 300,
  }),
});

module.exports = {
  ACTIVE_METRIC_KEYS,
  AUTO_RANKS,
  MANUAL_OVERRIDE_ROLES,
  OFFICIAL_LABEL,
  OFFICIAL_PHASE_START_DATE,
  PASSIVE_METRIC_KEYS,
  PRELAUNCH_LABEL,
  RANKING_LAUNCH_DATE: OFFICIAL_PHASE_START_DATE,
  RANK_REQUIREMENTS,
};
