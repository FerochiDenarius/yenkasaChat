require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const User = require(path.join(__dirname, '../models/user.model.js'));

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    console.log('🌐 URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    const systemUsername = 'YenkasaSystem';
    const systemEmail = 'system@yenkasa.app';

    console.log('🔍 Searching for system user:', systemEmail);

    let user = await User.findOne({
      $or: [{ username: systemUsername }, { email: systemEmail }]
    });

    if (!user) {
      console.log('➕ Creating system user...');

      user = await User.create({
        username: systemUsername,
        email: systemEmail,

        // password cannot be real login, use random placeholder
        password: 'SYSTEM_USER_DO_NOT_LOGIN',

        roleName: 'system',
        verified: true,
        isActive: false,
        profileImage: null
      });

      console.log('✅ System user created:', user);
    } else {
      console.log('⚠️ System user already exists. Updating fields...');

      user.roleName = 'system';
      user.verified = true;
      user.isActive = false;

      await user.save();

      console.log('✅ System user updated:', user);
    }

    console.log('🆔 SYSTEM USER ID:', user._id.toString());

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
