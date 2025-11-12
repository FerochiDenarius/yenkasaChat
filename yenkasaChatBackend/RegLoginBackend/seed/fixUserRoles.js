// seed/fixUserRoles.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Permission = require('../models/permissions.model');

async function fixUserRoles() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    console.log('🌐 URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ Connected to MongoDB');

    // 1️⃣ Load all permissions and map by role name
    const perms = await Permission.find({});
    const permMap = {};
    perms.forEach(p => {
      permMap[p.role.toLowerCase()] = p._id;
    });

    console.log('🔹 Permission map:', permMap);

    // 2️⃣ Update users who have string roles
    const users = await User.find({ role: { $type: 'string' } });
    console.log(`🔹 Found ${users.length} users with string roles`);

   // ✅ Fix users with undefined or null roles
for (const user of users) {
  let roleName = String(user.role || 'user').toLowerCase();
  const newRoleId = permMap[roleName];

  if (!newRoleId) {
    console.warn(`⚠️ No permission found for role "${roleName}" — skipping user ${user._id}`);
    continue;
  }

  user.role = newRoleId;
  user.permissions = undefined; // remove old permissions
  await user.save();
  console.log(`✅ Updated user ${user.username || user._id} to role ${roleName}`);
}


    // 3️⃣ Remove permissions field from all users just to be safe
    await User.updateMany({ permissions: { $exists: true } }, { $unset: { permissions: "" } });
    console.log('✅ Removed old permissions field from all users');

    console.log('🎉 User roles fix completed!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error fixing user roles:', err);
    process.exit(1);
  }
}

fixUserRoles();
