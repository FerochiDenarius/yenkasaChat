require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env')
});
const mongoose = require('mongoose');
const path = require('path');

const User = require(path.join(__dirname, '../models/user.model.js'));
const Permission = require(path.join(__dirname, '../models/permissions.model.js'));

const TEAM_MEMBERS = [
  'oparegyanwap@gmail.com',
  'wisdomazumah1784@gmail.com',
];

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);

    // Ensure default permissions exist
    await Permission.seedDefaults();

    // Get junior developer permission object
    const juniorPerm = await Permission.findOne({
      role: 'junior_developer',
    });

    if (!juniorPerm) {
      throw new Error('❌ junior_developer permission not found');
    }

    for (const email of TEAM_MEMBERS) {
      console.log(`🔍 Searching for ${email}`);

      const user = await User.findOne({ email });

      if (!user) {
        console.log(`⚠️ User not found: ${email}`);
        continue;
      }

      // Assign junior developer role
      user.role = juniorPerm._id;
      user.verified = true;

      await user.save();

      console.log(`✅ Granted Junior Developer to ${email}`);
    }

    console.log('🎉 Team role assignment completed');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();