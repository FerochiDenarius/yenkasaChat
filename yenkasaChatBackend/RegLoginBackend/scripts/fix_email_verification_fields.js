// fix_email_verification_fields.js
const mongoose = require("mongoose");
const path = require("path");

// Load .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/user.model");

const nowISO = () => new Date().toISOString();

async function fixEmailVerificationFields() {
  try {
    console.log("🔄 Connecting to DB...");
    console.log("MONGODB_URI:", process.env.MONGODB_URI);

    if (!process.env.MONGODB_URI) {
      throw new Error("❌ Missing MONGODB_URI in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB!");

    // --------------------------------------------------------
    // 1️⃣ REMOVE legacy / broken email verification fields
    // --------------------------------------------------------
    console.log("🧹 Removing legacy email verification fields...");

    const unsetResult = await User.updateMany(
      {},
      {
        $unset: {
          verificationCode: "",
          codeExpiresAt: "",
        },
      }
    );

    console.log(
      `✔ Legacy fields removed from ${unsetResult.modifiedCount} documents`
    );

    // --------------------------------------------------------
    // 2️⃣ ENSURE new email verification fields exist
    // --------------------------------------------------------
    console.log("🔧 Ensuring new email verification fields exist...");

    const setResult = await User.updateMany(
      {},
      {
        $set: {
          emailVerificationCode: null,
          emailVerificationExpires: null,
          emailVerificationCooldown: null,
          emailVerificationAttempts: 0,
        },
      }
    );

    console.log(
      `✔ Email verification fields normalized on ${setResult.modifiedCount} documents`
    );

    console.log(
      `\n🎉 EMAIL VERIFICATION MIGRATION COMPLETE @ ${nowISO()}`
    );

    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
    process.exit();

  } catch (error) {
    console.error("❌ Error fixing email verification fields:", error);
    process.exit(1);
  }
}

fixEmailVerificationFields();
