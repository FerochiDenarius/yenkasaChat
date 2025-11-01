// scripts/grantAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model'); // adjust if needed

async function run() {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);

    const userEmail = 'ferochidenarius@gmail.com'; // put your correct email
    console.log('Looking for user with email:', userEmail);

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.log(`❌ User with email ${userEmail} not found`);
      process.exit(1);
    }

   
    user.verified = true;
    await user.save();

    console.log(`✅ User ${userEmail} is now admin and verified`);
    console.log(user);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
