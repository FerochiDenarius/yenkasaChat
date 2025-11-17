require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const User = require(path.join(__dirname, '../models/user.model.js'));
const Community = require(path.join(__dirname, '../models/community.model.js'));

async function resetCommunities() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    console.log('🌐 URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // ---------------------------
    // 1️⃣ Clear all users' joined communities
    // ---------------------------
    console.log('🧹 Clearing joinedCommunities for all users...');
    const users = await User.find({});
    for (const user of users) {
      user.joinedCommunities = [];
      user.community = null; // primary community reset
      await user.save();
    }
    console.log(`✅ Cleared joinedCommunities for ${users.length} users`);

    // ---------------------------
    // 2️⃣ Clear all communities' members
    // ---------------------------
    console.log('🧹 Clearing members from all communities...');
    const communities = await Community.find({});
    for (const community of communities) {
      community.members = [];
      community.memberCount = 0;
      await community.save();
    }
    console.log(`✅ Cleared members from ${communities.length} communities`);

    // ---------------------------
    // Optional: Re-assign users to communities
    // ---------------------------
    // For example, you can assign the first community to each user as their primary
    // or implement your own logic for max 2-3 joins per user
    // Uncomment below if you want to auto-join
    /*
    console.log('🔄 Re-assigning users to communities...');
    const maxJoin = 2;
    for (const user of users) {
      let joinedCount = 0;
      for (const community of communities) {
        if (joinedCount >= maxJoin) break;

        // Add user to community
        community.members.push(user._id);
        community.memberCount = community.members.length;
        await community.save();

        // Add community to user's joinedCommunities
        user.joinedCommunities.push(community._id);
        if (!user.community) user.community = community._id; // first one as primary
        joinedCount++;
      }
      await user.save();
    }
    console.log(`✅ Re-assigned users to communities`);
    */

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    console.log('🎉 Done resetting communities and users!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error resetting communities:', err);
    process.exit(1);
  }
}

resetCommunities();
