const RANKING_LAUNCH_DATE = new Date(
  process.env.RANKING_LAUNCH_DATE || "2026-05-25T00:00:00.000Z"
);

const PRELAUNCH_LABEL = "Pre-launch ranking period";

const VERIFIED_REQUIREMENTS = Object.freeze({
  accountAge: 21,
  comments: 30,
  followers: 100,
  maxLikes: 30,
  dailyLogins: 30,
  adsViewed: 100
});

function multiplyRequirements(base, factor) {
  return {
    accountAge: Math.floor(base.accountAge * factor),
    comments: Math.floor(base.comments * factor),
    followers: Math.floor(base.followers * factor),
    maxLikes: Math.floor(base.maxLikes * factor),
    dailyLogins: Math.floor(base.dailyLogins * factor),
    adsViewed: Math.floor(base.adsViewed * factor)
  };
}

const RANK_REQUIREMENTS = Object.freeze({
  verified: VERIFIED_REQUIREMENTS,
  admin: multiplyRequirements(VERIFIED_REQUIREMENTS, 2),
  moderator: multiplyRequirements(VERIFIED_REQUIREMENTS, 3)
});

module.exports = {
  PRELAUNCH_LABEL,
  RANKING_LAUNCH_DATE,
  RANK_REQUIREMENTS
};
