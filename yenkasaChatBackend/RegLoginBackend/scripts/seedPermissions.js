// scripts/seedPermissions.js
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const Permission = require(path.join(__dirname, '../models/permissions.model.js'));

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);

    await Permission.seedDefaults();

    console.log('✅ Permissions seeded successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding permissions:', err);
    process.exit(1);
  }
}

run();
