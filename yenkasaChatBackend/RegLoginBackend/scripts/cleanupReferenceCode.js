// scripts/cleanupReferenceCode.js
require("dotenv").config();
const mongoose = require("mongoose");

async function cleanup() {
  try {
    console.log("🔌 Connecting to MongoDB...");

    // Use the same URI key as your working grantAdmin.js file
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
      throw new Error("❌ Missing MongoDB URI. Please set MONGODB_URI in your .env file.");
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected successfully");

    const collection = mongoose.connection.collection("cointransactions");

    // Check and drop the old index if it exists
    const indexes = await collection.indexes();
    const refIndex = indexes.find(i => i.name === "referenceCode_1");

    if (refIndex) {
      await collection.dropIndex("referenceCode_1");
      console.log("🧹 Dropped old 'referenceCode_1' unique index");
    } else {
      console.log("ℹ️ No 'referenceCode_1' index found (already removed)");
    }

    // Remove the field from existing documents
    const result = await collection.updateMany(
      { referenceCode: { $exists: true } },
      { $unset: { referenceCode: "" } }
    );
    console.log(`🧾 Removed 'referenceCode' from ${result.modifiedCount} documents`);

    await mongoose.disconnect();
    console.log("✅ Cleanup complete and disconnected.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }
}

cleanup();
