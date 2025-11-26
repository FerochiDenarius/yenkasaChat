// seed/seedRoleNames.js

require('dotenv').config();  // <-- SAME AS YOUR WORKING SCRIPT
const mongoose = require('mongoose');
const path = require('path');

const User = require(path.join(__dirname, '../models/user.model.js'));
const Permission = require(path.join(__dirname, '../models/permissions.model.js'));

async function seedRoleNames() {
  try {
    console.log("🔄 Connecting to DB...");
    console.log("🌐 URI:", process.env.MONGODB_URI);

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ Connected!");

    // Load permissions
    const permissions = await Permission.find().lean();
    const permById = new Map(permissions.map(p => [String(p._id), p.role]));

    console.log("🔍 Loaded permissions:", permissions.length);

    // Update all users
    const users = await User.find({});
    let count = 0;

    for (const user of users) {
      let roleName = "user";

      if (user.role && permById.has(String(user.role))) {
        roleName = permById.get(String(user.role));
      }

      if (user.roleName !== roleName) {
        user.roleName = roleName;
        await user.save();
        count++;
      }
    }

    console.log(`🎉 Updated ${count} users with roleName field`);
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

seedRoleNames();
