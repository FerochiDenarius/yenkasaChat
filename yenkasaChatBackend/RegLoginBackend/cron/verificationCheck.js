const cron = require('node-cron');
const User = require('../models/user.model');
const evaluateUserVerification = require('../services/verificationEvaluator');

cron.schedule('0 0 * * 0', async () => { // runs weekly
  console.log('🔍 Running weekly verification check...');
  const users = await User.find({ verified: false });
  for (const user of users) {
    await evaluateUserVerification(user);
  }
  console.log('✅ Verification check complete.');
});
