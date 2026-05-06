// services/verificationScheduler.js
const cron = require("node-cron");
const User = require("../models/user.model");
const AppVerification = require("../models/appverification.model");
const getUserMetrics =
  require("./userPerformanceMetrics").getUserPerformanceMetrics;
const { reward } = require("./reward.service");
const { buildRankSummary, isPhaseActive, syncUserRole } = require("./ranking.service");

console.log("🕒 Yenkasa Verification Scheduler Initialized...");

/**
 * CRON: runs daily at midnight (Africa/Accra)
 */
cron.schedule(
  "0 0 * * *",
  async () => {
    console.log(
      `\n🔁 Running daily verification + promotion cycle — ${new Date().toLocaleString(
        "en-GB",
        { timeZone: "Africa/Accra" }
      )}`
    );

    try {
      const users = await User.find({});
      console.log(`👥 Checking ${users.length} users...`);

      let rankUpdates = 0;
      let advancedPhases = 0;

      for (const user of users) {
        let appVer = await AppVerification.findOne({ userId: user._id });
        if (!appVer) {
          appVer = new AppVerification({ userId: user._id });
          await appVer.save();
        }

        // ==========================================================
        // 1️⃣ UPDATE ACCOUNT AGE (DAILY)
        // ==========================================================
        await appVer.updateAccountAge(user.createdAt);

        // Daily YKC reward is capped and normalized by reward.service.
        await reward(user._id, 2, {
          type: "REWARD_ACCOUNT_AGE",
          description: "Daily account activity reward (+2)",
        });

        // ==========================================================
        // 2️⃣ UPDATE FULL PERFORMANCE METRICS (Lifetime Calculations)
        // ==========================================================
        const lifetime = await getUserMetrics(user._id);

        // FIXED FIELD ALIGNMENT WITH BACKEND SCHEMA
        appVer.metrics.postsCreated = lifetime.postsCreated; // correct
        appVer.metrics.totalPostCount = lifetime.postsCreated;

        appVer.metrics.totalFollowers = lifetime.totalFollowers || lifetime.followers;
        appVer.metrics.totalFollowing = lifetime.totalFollowing || 0;

        appVer.metrics.totalLikesReceived = lifetime.likesReceived;
        appVer.metrics.maxLikesOnPost = lifetime.maxLikesOnPost;
        appVer.metrics.totalLikesCount = lifetime.totalLikesCount || 0;

        appVer.metrics.totalViewsReceived = lifetime.viewsReceived;
        appVer.metrics.totalViewsCount = lifetime.totalViewsCount || 0;

        appVer.metrics.totalCommentsReceived = lifetime.commentsReceived;
        appVer.metrics.totalRepliesReceived = lifetime.repliesReceived;
        appVer.metrics.commentLikesReceived = lifetime.commentLikesReceived;

        appVer.metrics.totalComments = lifetime.commentsMade; // user-made comments
        appVer.metrics.totalCommentsMade = lifetime.commentsMade;
        appVer.metrics.totalShares = lifetime.totalShares || 0;

        await appVer.save();

        const previousRole = user.roleName || user.role?.role || "unverified";
        const rankSummary = buildRankSummary(appVer.metrics, previousRole);
        const syncedRole = await syncUserRole(user, appVer.metrics);

        if (syncedRole !== previousRole) {
          rankUpdates++;
          console.log(`🏅 RANK UPDATED: ${user.username} → ${syncedRole}`);
        }

        // ==========================================================
        // 3️⃣ PHASE ADVANCEMENT (ONLY AFTER OFFICIAL LAUNCH)
        // ==========================================================
        if (isPhaseActive()) {
          const canAdvance =
            rankSummary.progress.allMet &&
            new Date() >= appVer.phaseEndDate &&
            appVer.currentPhase < 6;

          if (canAdvance) {
            await appVer.advancePhase();
            advancedPhases++;
            console.log(`🎉 ${user.username} advanced to Phase ${appVer.currentPhase}`);
          }
        }
      }

      console.log(`
✨ Verification cycle completed!
📈 Phase advancements: ${advancedPhases}
🏅 Rank updates: ${rankUpdates}
`);

    } catch (err) {
      console.error("❌ Scheduler error:", err);
    }
  },
  { timezone: "Africa/Accra" }
);
