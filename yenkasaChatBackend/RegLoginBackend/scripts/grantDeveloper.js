require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const User = require(path.join(__dirname, '../models/user.model.js'));
const Permission = require(path.join(__dirname, '../models/permission.model.js'));

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);

    const userEmail = 'ofosumenyabrightkofi@gmail.com';
    console.log('🔍 Searching for user:', userEmail);

    const user = await User.findOne({ email: userEmail });
    if (!user) throw new Error(`No user found with email ${userEmail}`);

    // Update role and verification
    user.role = 'senior_developer';
    user.verified = true;

    await user.save();

    console.log(`✅ ${userEmail} is now a SENIOR DEVELOPER and verified!`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
