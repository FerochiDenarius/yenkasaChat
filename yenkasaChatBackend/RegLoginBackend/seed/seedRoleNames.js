// seed/seedRoleNames.js
const mongoose = require("mongoose");
const path = require("path");

// Load .env from project root
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/user.model");
const Permission = require("../models/permissions.model");

async function seedRoleNames() {
  try {
    console.log("🔄 Connecting to DB...");
    console.log("MONGODB_URI:", process.env.MONGODB_URI);

    if (!process.env.MONGODB_URI) {
      throw new Error("❌ Missing MONGODB_URI in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB!");

    // Load all Permission docs
    console.log("📥 Loading Permission documents...");
    const permissions = await Permission.find().lean();

    const permById = new Map();
    permissions.forEach(p => {
      permById.set(String(p._id), p.role);
    });

    console.log("🔍 Permissions loaded:", permissions.length);

    // Update users
    let updated = 0;
    const users = await User.find().lean();

    for (const user of users) {
      let roleName = "user";

      if (user.role && permById.has(String(user.role))) {
        roleName = permById.get(String(user.role));
      }

      // Only update if different or missing
      if (user.roleName !== roleName) {
        await User.updateOne(
          { _id: user._id },
          { $set: { roleName: roleName } }
        );
        updated++;
      }
    }

    console.log(`🎉 Role name seeding complete! Updated ${updated} users.`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding role names:", error);
    process.exit(1);
  }
}

seedRoleNames();
