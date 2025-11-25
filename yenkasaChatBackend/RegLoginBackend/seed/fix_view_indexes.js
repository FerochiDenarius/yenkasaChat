// fix_view_indexes.js
const mongoose = require("mongoose");
const path = require("path");

// Load .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const View = require("../models/view.model");

async function fixViewIndexes() {
  try {
    console.log("🔄 Connecting to DB...");
    console.log("MONGODB_URI:", process.env.MONGODB_URI);

    if (!process.env.MONGODB_URI) {
      throw new Error("❌ Missing MONGODB_URI in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB!");

    // --------------------------------------------------------
    // 1️⃣ DELETE all broken documents where activityId is null or missing
    // --------------------------------------------------------
    console.log("🗑️ Removing invalid view documents (activityId: null or missing)…");

    const deleteResult = await View.deleteMany({
      $or: [
        { activityId: { $exists: false } },
        { activityId: null },
        { activityId: "" }
      ]
    });

    console.log(`✔ Removed ${deleteResult.deletedCount} invalid view records`);

    // --------------------------------------------------------
    // 2️⃣ DROP old wrong index if it exists
    // --------------------------------------------------------
    console.log("🔧 Dropping old index if it exists…");

    try {
      await View.collection.dropIndex("post_1_user_1");
      console.log("✔ Dropped old index post_1_user_1");
    } catch (e) {
      console.log("ℹ️ Old index does not exist or already removed");
    }

    // --------------------------------------------------------
    // 3️⃣ CREATE correct unique index on activityId
    // --------------------------------------------------------
    console.log("⚙️ Creating new unique index on activityId…");

    await View.collection.createIndex(
      { activityId: 1 },
      { unique: true }
    );

    console.log("🎉 FIX COMPLETE — view indexes repaired successfully!");
    process.exit();

  } catch (error) {
    console.error("❌ Error fixing indexes:", error);
    process.exit(1);
  }
}

fixViewIndexes();
