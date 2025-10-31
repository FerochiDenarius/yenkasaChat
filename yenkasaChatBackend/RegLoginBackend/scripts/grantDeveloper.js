// scripts/grantDeveloper.js
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// ✅ Adjust path to your User model if different
const User = require(path.join(__dirname, '../models/user.model.js'));

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const userEmail = 'ofosumenyabrightkofi@gmail.com'; // 👈 your email
    console.log('🔍 Searching for user:', userEmail);

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.log(`❌ No user found with email ${userEmail}`);
      process.exit(1);
    }

    // ✅ Grant developer privileges
    user.role = 'developer';
    user.verified = true;
    user.permissions = {
      canPost: true,
      canComment: true,
      canCreateCommunity: true,
    };

    await user.save();

    console.log(`✅ ${userEmail} is now a DEVELOPER and verified!`);
    console.log('👤 Updated user:', user);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
