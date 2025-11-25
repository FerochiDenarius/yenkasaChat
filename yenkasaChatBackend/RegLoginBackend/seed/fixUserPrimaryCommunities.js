// fixPrimaryCommunities.js
const mongoose = require("mongoose");
const path = require("path");

// Load .env
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/user.model");
const Community = require("../models/community.model");

async function fixPrimaryCommunities() {
  try {
    console.log("🔄 Connecting to DB...");
    console.log("MONGODB_URI:", process.env.MONGODB_URI);

    if (!process.env.MONGODB_URI) {
      throw new Error("❌ Missing MONGODB_URI in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB!");

    // ----------- 1️⃣ Fetch users missing primary community -----------
    const users = await User.find({ community: null }).lean();
    console.log(`👤 Users missing primary community: ${users.length}`);

    for (const user of users) {
      const rawLocation = user.location;
      const location = rawLocation?.trim();

      if (!location) {
        console.log(`⚠️ User ${user._id} has NO location → skip`);
        continue;
      }

      console.log(`\n➡️ Fixing user ${user._id} (${user.username}) | Location: ${location}`);

      // ----------- 2️⃣ Normalize location (critical fix) -----------
      const normalizedName = location.toLowerCase();

      // ----------- 3️⃣ Check for existing community (lowercase) -----------
      let community = await Community.findOne({ name: normalizedName });

      if (!community) {
        console.log(`🏗 Creating new community for "${location}"`);

        community = await Community.create({
          name: normalizedName,         // FIXED
          displayName: location,        // nice readable name
          description: `${location} community`,
          memberCount: 0,
          postCount: 0,
          location: location,
          isApproved: true,             // OPTIONAL: auto approve if needed
        });
      } else {
        console.log(`✔ Found existing community: ${community.displayName} (${community._id})`);
      }

      // ----------- 4️⃣ Assign community to user -----------
      await User.findByIdAndUpdate(user._id, {
        community: community._id,             // primary community
        $addToSet: { joinedCommunities: community._id }, // ensure included
      });

      // ----------- 5️⃣ Add user to community member list -----------
      await Community.findByIdAndUpdate(community._id, {
        $addToSet: { members: user._id },
        $set: { memberCount: (community.members?.length || 0) + 1 }
      });

      console.log(`✔ Linked ${location} → User ${user._id}`);
    }

    console.log("\n🎉 DONE — primary communities FIXED for all users!");
    process.exit();
  } catch (error) {
    console.error("💥 Error fixing communities:", error);
    process.exit(1);
  }
}

fixPrimaryCommunities();
