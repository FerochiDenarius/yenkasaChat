require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');     // ✅ FIXED
const Community = require('../models/community'); // ✅ correct since file = community.js



async function assignCommunityFromLocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({ $or: [{ community: null }, { community: { $exists: false } }] });

    console.log(`👥 Found ${users.length} users without a community.`);

    for (const user of users) {
      const locationName = user.location?.trim() || 'Unassigned';

      // Check if this location already exists as a community
      let community = await Community.findOne({ name: locationName });

      if (!community) {
        community = await Community.create({
          name: locationName,
          description: `Community for users from ${locationName}`,
          isDefault: true,
          isActive: true,
        });
        console.log(`🌱 Created new community: ${locationName}`);
      }

      // Assign the community to the user
      user.community = community._id;
      await user.save();
      console.log(`✅ Assigned ${user.username} → ${locationName}`);
    }

    console.log('🎯 All users now have a community.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error assigning communities:', error);
    process.exit(1);
  }
}

assignCommunityFromLocation();
