require('dotenv').config();
const mongoose = require('mongoose');

const Permission = require('./models/permissions.model');

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB Atlas...');

    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ Connected to Atlas');

    await Permission.seedDefaults();

    console.log('✅ Permissions updated successfully');

    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();