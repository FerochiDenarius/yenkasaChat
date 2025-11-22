const mongoose = require("mongoose");
const path = require("path");

// Load .env from the correct folder
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/user.model");
const Community = require("../models/community.model");

async function fixPrimaryCommunities() {
  try {
    console.log("🔄 Connecting to DB...");
    console.log("🌐 MONGODB_URI:", process.env.MONGODB_URI);

    if (!process.env.MONGODB_URI) {
      throw new Error("❌ MONGODB_URI is missing. Check your .env file!");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected!");

    const users = await User.find({ community: null }).lean();
    console.log(`👤 Users missing primary community: ${users.length}`);

    for (const user of users) {
      const location = user.location?.trim();

      if (!location) {
        console.log(`⚠️ User ${user._id} has NO location, skipping`);
        continue;
      }

      console.log(`➡️ Fixing user ${user._id} (${user.email}) | Location: ${location}`);

      let community = await Community.findOne({ name: location });

      if (!community) {
        console.log(`🏗 Creating missing community for location "${location}"`);

        community = await Community.create({
          name: location,
          displayName: location,
          description: `${location} community`,
          memberCount: 0,
          postCount: 0,
          location: location,
        });
      }

      // Assign community to user
      await User.findByIdAndUpdate(user._id, {
        community: community._id,
      });

      // Add user as member if not added
      await Community.findByIdAndUpdate(community._id, {
        $addToSet: { members: user._id },
        $inc: { memberCount: 1 },
      });

      console.log(`✔️ Assigned ${location} → User ${user._id}`);
    }

    console.log("🎉 Done fixing primary communities!");
    process.exit();
  } catch (error) {
    console.error("💥 Error:", error);
    process.exit(1);
  }
}

fixPrimaryCommunities();
