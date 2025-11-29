// services/verificationScheduler.js
const cron = require('node-cron');
const User = require('../models/user.model');
const AppVerification = require('../models/appverification.model');
const getUserMetrics = require('./userPerformanceMetrics').getUserPerformanceMetrics;

console.log("🕒 Yenkasa Verification Scheduler Initialized...");

// Promotion thresholds
const ADMIN_DAYS = 90;
const MOD_DAYS = Math.floor(ADMIN_DAYS * 1.8);  // 162

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
        // 1️⃣ UPDATE ACCOUNT AGE & DAILY LOGIN TRACKING
        // ==========================================================
        await appVer.updateAccountAge(user.createdAt);
        // (dailyLogins incremented by TrackLogin API – not scheduler)

        // ==========================================================
        // 2️⃣ UPDATE FULL PERFORMANCE METRICS
        // ==========================================================
        const lifetime = await getUserMetrics(user._id);

        appVer.metrics.totalFollowers = lifetime.followers;
        appVer.metrics.totalComments = lifetime.commentsReceived;
        appVer.metrics.maxLikesOnPost = lifetime.likesReceived;
        appVer.metrics.adsViewed = appVer.metrics.adsViewed; // already tracked
        appVer.metrics.viewsReceived = lifetime.viewsReceived;
        appVer.metrics.postsCreated = lifetime.postsCreated;
        appVer.metrics.repliesReceived = lifetime.repliesReceived;

        await appVer.save();

        // ==========================================================
        // 3️⃣ PHASE ADVANCEMENT (if requirements met)
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
          console.log(`🎉 ${user.username} advanced to Phase ${appVer.currentPhase}`);
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
