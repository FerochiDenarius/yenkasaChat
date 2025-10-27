// services/verificationScheduler.js
const cron = require('node-cron');
const User = require('../models/user.model');
const evaluateUserVerification = require('./verificationEvaluator');

console.log('🕒 Yenkasa verification scheduler initialized...');

/**
 * Run verification check for all users once per day at midnight (Africa/Accra)
 */
cron.schedule('0 0 * * *', async () => {
  console.log(`\n🔁 Running daily verification check — ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' })}`);

  try {
    const users = await User.find({}, '_id username verified verificationPhase activityStats createdAt coinsBalance');
    console.log(`👥 Checking ${users.length} users...`);

    let verifiedCount = 0;
    let bonusIssuedCount = 0;

    for (const user of users) {
      const result = await evaluateUserVerification(user);
      if (result.verified && !result.alreadyVerified) {
        verifiedCount++;
        if (result.bonusIssued) bonusIssuedCount++;
        console.log(`✅ Verified ${user.username} — Bonus: ${result.bonusIssued ? '✅' : '❌'}`);
      }
    }

    console.log(`\n✨ Scheduler completed: ${verifiedCount} verified, ${bonusIssuedCount} bonuses issued.\n`);
  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
}, {
  timezone: 'Africa/Accra'
});
