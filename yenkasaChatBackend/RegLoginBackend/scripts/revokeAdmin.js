// scripts/revokeAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model'); // adjust path if needed

function printUsageAndExit() {
  console.log(`
Usage:
  node scripts/revokeAdmin.js <email-or-id> [--id] [--dry]

Examples:
  node scripts/revokeAdmin.js kofi@example.com
  node scripts/revokeAdmin.js 652b9c2f1b2a4a3d9e5f1234 --id
  node scripts/revokeAdmin.js kofi@example.com --dry   # show changes without saving
`);
  process.exit(1);
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) printUsageAndExit();

  const input = args[0];
  const flags = new Set(args.slice(1));
  return {
    input,
    byId: flags.has('--id'),
    dryRun: flags.has('--dry')
  };
}

function stripAdminFromUser(user) {
  const changes = {};

  // CASE 1: role as a string
  if (typeof user.role === 'string') {
    changes.oldRole = user.role;
    if (user.role.toLowerCase() === 'admin') {
      user.role = 'user';
      changes.newRole = user.role;
    } else {
      // if it's something else, we still normalize to 'user' only if explicitly admin
      changes.note = 'role was not "admin", left unchanged';
    }
  }

  // CASE 2: roles as an array
  if (Array.isArray(user.roles)) {
    const hadAdmin = user.roles.includes('admin');
    changes.oldRoles = [...user.roles];
    user.roles = user.roles.filter(r => r.toLowerCase() !== 'admin');
    if (!user.roles.length) {
      // ensure at least 'user' role remains
      user.roles.push('user');
    }
    changes.newRoles = [...user.roles];
    changes.removedAdminFromArray = hadAdmin;
  }

  // CASE 3: permissions object
  if (user.permissions && typeof user.permissions === 'object') {
    changes.oldPermissions = { ...user.permissions };
    if ('isAdmin' in user.permissions) user.permissions.isAdmin = false;
    if ('admin' in user.permissions) user.permissions.admin = false;
    // also remove any explicit admin permission flags
    Object.keys(user.permissions).forEach(k => {
      if (k.toLowerCase().includes('admin')) {
        user.permissions[k] = false;
      }
    });
    changes.newPermissions = { ...user.permissions };
  }

  // If schema uses some other field names, you can add them here.

  return changes;
}

async function run() {
  const { input, byId, dryRun } = parseArgs();

  try {
    await connectDB();

    const query = byId ? { _id: input } : { email: input };
    console.log('Searching user with query:', query);

    const user = await User.findOne(query).lean(); // use lean() for read-only inspection
    if (!user) {
      console.error(`❌ User not found for ${byId ? '_id' : 'email'} = ${input}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('Found user:', { _id: user._id, email: user.email, role: user.role, roles: user.roles });

    // load a writable instance so we can modify and save
    const writable = await User.findById(user._id);
    const changes = stripAdminFromUser(writable);

    // Determine if any meaningful change was made
    const meaningfulChange = (
      (changes.newRole && changes.newRole !== changes.oldRole) ||
      (changes.removedAdminFromArray) ||
      (changes.oldPermissions && JSON.stringify(changes.oldPermissions) !== JSON.stringify(changes.newPermissions))
    );

    console.log('Planned changes:', changes);

    if (!meaningfulChange) {
      console.log('ℹ️ No admin privileges detected or no changes required.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (dryRun) {
      console.log('✔ Dry run — changes shown above were NOT saved.');
      await mongoose.disconnect();
      process.exit(0);
    }

    await writable.save();
    console.log(`✅ Successfully updated user ${user.email} (${user._id}). Admin privileges removed.`);
    console.log('New saved record preview:', {
      _id: writable._id,
      email: writable.email,
      role: writable.role,
      roles: writable.roles,
      permissions: writable.permissions
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

run();
