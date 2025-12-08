// approveCommunities.js
const mongoose = require("mongoose");
const path = require("path");

// Load .env
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Community = require("../models/community.model");

async function approveAllCommunities() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log("MONGODB_URI:", process.env.MONGODB_URI);

    if (!process.env.MONGODB_URI) {
      throw new Error("❌ Missing MONGODB_URI in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected!");

    // ---- SEED LOGIC ----
    const result = await Community.updateMany(
      {},
      { $set: { isApproved: true } }
    );

    console.log(`🎉 DONE! Approved communities: ${result.modifiedCount}`);
    process.exit();
  } catch (err) {
    console.error("💥 ERROR approving communities:", err);
    process.exit(1);
  }
}

approveAllCommunities();
