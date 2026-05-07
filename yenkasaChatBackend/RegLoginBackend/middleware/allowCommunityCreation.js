const { getUserPerformanceMetrics } = require('../services/userPerformanceMetrics');
const { canApproveContent } = require('./permissions');

const VERIFIED_REQUIREMENTS = {
  accountAgeDays: 60,
  followers: 500,
  postsCreated: 100,
  commentsReceived: 500,
  repliesReceived: 50,
  likesReceived: 2000,
  viewsReceived: 10000,
};

function msToDays(ms) {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

module.exports = async function allowCommunityCreation(req, res, next) {
  try {
    const user = req.user;

    // 1️⃣ Privileged roles skip all checks
    if (canApproveContent(user)) {
      return next();
    }

    // 2️⃣ Verified users must pass performance-based requirements
    if (user.verified === true) {
      const metrics = await getUserPerformanceMetrics(user._id);
      const accountAge = msToDays(Date.now() - new Date(user.createdAt).getTime());

      const ok =
        accountAge >= VERIFIED_REQUIREMENTS.accountAgeDays &&
        metrics.followers >= VERIFIED_REQUIREMENTS.followers &&
        metrics.postsCreated >= VERIFIED_REQUIREMENTS.postsCreated &&
        metrics.commentsReceived >= VERIFIED_REQUIREMENTS.commentsReceived &&
        metrics.repliesReceived >= VERIFIED_REQUIREMENTS.repliesReceived &&
        metrics.likesReceived >= VERIFIED_REQUIREMENTS.likesReceived &&
        metrics.viewsReceived >= VERIFIED_REQUIREMENTS.viewsReceived;

      if (ok) return next();

      return res.status(403).json({
        error: "Verified user requirements not met",
        yourMetrics: {
          accountAge,
          ...metrics
        },
        required: VERIFIED_REQUIREMENTS
      });
    }

    // 3️⃣ Normal users (unverified)
    return res.status(403).json({
      error: "Permission denied",
      message: "You must be verified or have a privileged role to create a community"
    });

  } catch (err) {
    console.error("❌ Community permission error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
