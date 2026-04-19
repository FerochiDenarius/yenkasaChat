// services/verificationScheduler.js
const cron = require("node-cron");
const User = require("../models/user.model");
const AppVerification = require("../models/appverification.model");
const getUserMetrics =
  require("./userPerformanceMetrics").getUserPerformanceMetrics;
const { reward } = require("./reward.service");

console.log("🕒 Yenkasa Verification Scheduler Initialized...");

// Promotion thresholds
const ADMIN_DAYS = 90;
const MOD_DAYS = Math.floor(ADMIN_DAYS * 1.8); // 162

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

      let promotedAdmins = 0;
      let promotedModerators = 0;
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

        // DAILY ACCOUNT AGE REWARD — Always 10 coins for all roles
        await reward(user._id, 10, {
          type: "REWARD_ACCOUNT_AGE",
          description: "Daily account age reward (+10)",
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

        // ==========================================================
        // 3️⃣ PHASE ADVANCEMENT
        // ==========================================================
        const progress = appVer.checkRequirementsMet();
        const now = new Date();

        const canAdvance =
          progress.allMet &&
          now >= appVer.phaseEndDate &&
          appVer.currentPhase < 6;

        if (canAdvance) {
          await appVer.advancePhase();
          advancedPhases++;

          console.log(
            `🎉 ${user.username} advanced to Phase ${appVer.currentPhase}`
          );

          // ⭐ VERIFICATION COMPLETION REWARD (PHASE 6)
          if (appVer.currentPhase === 6) {
            let verifyReward = 100;

            if (user.role === "admin") verifyReward = 300;
            if (user.role === "moderator") verifyReward = 500;

            await reward(user._id, verifyReward, {
              type: "REWARD_VERIFICATION",
              description: `Verification completed (+${verifyReward})`,
            });

            console.log(
              `💎 Awarded ${verifyReward} coins to ${user.username} for verification completion`
            );
          }
        }

        // ==========================================================
        // 4️⃣ ROLE PROMOTION LOGIC
        // ==========================================================
        const accountAge = appVer.metrics.accountAge;
        const dailyLogins = appVer.metrics.dailyLogins;

        // Verified → Admin
        if (user.role === "verified") {
          if (accountAge >= ADMIN_DAYS && dailyLogins >= ADMIN_DAYS) {
            user.role = "admin";
            await user.save();
            promotedAdmins++;
            console.log(`⚙️ PROMOTED: ${user.username} → ADMIN`);
          }
        }

        // Admin → Moderator
        if (user.role === "admin") {
          if (accountAge >= MOD_DAYS && dailyLogins >= MOD_DAYS) {
            user.role = "moderator";
            await user.save();
            promotedModerators++;
            console.log(`🛡️ PROMOTED: ${user.username} → MODERATOR`);
          }
        }
      }

      console.log(`
✨ Verification cycle completed!
📈 Phase advancements: ${advancedPhases}
⚙️ Admin promotions: ${promotedAdmins}
🛡️ Moderator promotions: ${promotedModerators}
`);

    } catch (err) {
      console.error("❌ Scheduler error:", err);
    }
  },
  { timezone: "Africa/Accra" }
);
