// seed/assignCommunityToUsers.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Community = require('../models/community');

async function assignCommunityToUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find users missing a community
    const users = await User.find({
      $or: [{ community: null }, { community: { $exists: false } }]
    });

    console.log(`👥 Found ${users.length} users without a community.`);

    for (const user of users) {
      // Use user's location as the community name, fallback to "Unassigned"
      const locationName = user.location?.trim() || 'Unassigned';

      // Try to find an existing community with the same name
      let community = await Community.findOne({ name: locationName });

      // If it doesn't exist, create a new one
      if (!community) {
        community = await Community.create({
          name: locationName,
          description: `Community for users from ${locationName}`,
          locationTag: locationName,
          createdBy: null, // Optional: leave null for now
          coverImage: null,
        });
        console.log(`🌱 Created new community: ${locationName}`);
      }

      // Assign the community to the user
      user.community = community._id;
      await user.save();

      console.log(`✅ Assigned ${user.username} → ${locationName}`);
    }

    console.log('🎯 All users now have a community.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error assigning communities:', error);
    process.exit(1);
  }
}

assignCommunityToUsers();
