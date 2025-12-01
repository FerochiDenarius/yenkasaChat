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
    // 1️⃣ REMOVE invalid View entries that break indexes
    // --------------------------------------------------------
    console.log("🗑️ Removing invalid view documents (activityId missing)…");

    const deleteResult = await View.deleteMany({
      $or: [
        { activityId: { $exists: false } },
        { activityId: null },
        { activityId: "" }
      ]
    });

    console.log(`✔ Removed ${deleteResult.deletedCount} invalid view records`);

    // --------------------------------------------------------
    // 2️⃣ MIGRATION: Rename viewCount → viewsCount
    // --------------------------------------------------------
    console.log("🔄 Migrating field 'viewCount' → 'viewsCount'...");

    const renameResult = await View.updateMany(
      { viewCount: { $exists: true } },
      { $rename: { viewCount: "viewsCount" } }
    );

    console.log(`✔ Renamed ${renameResult.modifiedCount} documents`);

    // --------------------------------------------------------
    // 3️⃣ Ensure viewsCount exists on all documents
    // --------------------------------------------------------
    console.log("🔧 Ensuring 'viewsCount' exists on all documents...");

    const addMissing = await View.updateMany(
      { viewsCount: { $exists: false } },
      { $set: { viewsCount: 0 } }
    );

    console.log(`✔ Added missing viewsCount to ${addMissing.modifiedCount} docs`);

    // --------------------------------------------------------
    // 4️⃣ Remove leftover viewCount field (cleanup)
    // --------------------------------------------------------
    console.log("🧹 Cleaning leftover 'viewCount' fields…");

    const cleanup = await View.updateMany(
      { viewCount: { $exists: true } },
      { $unset: { viewCount: "" } }
    );

    console.log(`✔ Cleaned ${cleanup.modifiedCount} leftover viewCount fields`);

    // --------------------------------------------------------
    // 5️⃣ DROP old wrong index
    // --------------------------------------------------------
    console.log("🔧 Dropping old index if it exists…");

    try {
      await View.collection.dropIndex("post_1_user_1");
      console.log("✔ Dropped old index post_1_user_1");
    } catch (e) {
      console.log("ℹ️ Old index does not exist or already removed");
    }

    // --------------------------------------------------------
    // 6️⃣ CREATE correct unique index on activityId
    // --------------------------------------------------------
    console.log("⚙️ Creating new unique index on activityId…");

    await View.collection.createIndex(
      { activityId: 1 },
      { unique: true }
    );

    console.log("🎉 FIX COMPLETE — view model + indexes migrated successfully!");
    process.exit();

  } catch (error) {
    console.error("❌ Error fixing views:", error);
    process.exit(1);
  }
}

fixViewIndexes();
