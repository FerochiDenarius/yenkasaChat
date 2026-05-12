// models/permissions.model.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

// --------------------------------------------
// Rank Order Hierarchy
// --------------------------------------------
const rankOrder = [
  'unverified',
  'verified',
  'rising_star',
  'legend',
  'moderator',
  'admin',
  'junior_developer',
  'senior_developer',
];

// --------------------------------------------
// Utility: Normalize Role String
// --------------------------------------------
const normalize = (role = '') => {
  if (!role) return 'unverified';

  // Handle object reference (e.g., populated Permission doc)
  if (typeof role === 'object') {
    if (role.accessRole) return normalize(role.accessRole);
    if (role.roleName) return normalize(role.roleName);
    if (role.role) return String(role.role).trim().toLowerCase().replace(/\s+/g, '_');
    if (role.name) return String(role.name).trim().toLowerCase().replace(/\s+/g, '_');
    return 'unverified';
  }

  // Handle array (if multiple roles)
  if (Array.isArray(role)) {
    return normalize(role[0]);
  }

  // Default string normalization
  const normalized = String(role).trim().toLowerCase().replace(/\s+/g, '_') || 'unverified';
  if (normalized === 'user') return 'unverified';
  if (normalized === 'developer') return 'senior_developer';
  if (normalized === 'senior_dev' || normalized === 'senior-developer') return 'senior_developer';
  if (normalized === 'junior_dev' || normalized === 'junior-developer') return 'junior_developer';
  if (normalized === 'super_admin' || normalized === 'superadmin') return 'senior_developer';
  return normalized;
};


// --------------------------------------------
// Permission Schema
// Each role has its own stored permission flags
// --------------------------------------------//
const permissionSchema = new Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: rankOrder,
    },
    canPost: { type: Boolean, default: false },
    canApprove: { type: Boolean, default: false },
    canCreateCommunity: { type: Boolean, default: false },
    canAssignRoles: { type: Boolean, default: false },
    canRevoke: { type: Boolean, default: false },
    canSuspend: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// --------------------------------------------
// STATICS — Logic functions similar to Kotlin side
// --------------------------------------------

// Expose rank order and normalizer
permissionSchema.statics.rankOrder = rankOrder;
permissionSchema.statics.normalize = normalize;

// Basic permission checks
permissionSchema.statics.canPost = function (role, verified = false) {
  const r = normalize(role);
  if (verified && r === 'unverified') return true;
  return [
    'verified',
    'rising_star',
    'legend',
    'admin',
    'moderator',
    'junior_developer',
    'senior_developer',
  ].includes(r);
};

permissionSchema.statics.canApprove = function (role) {
  const r = normalize(role);
  return ['admin', 'moderator', 'junior_developer', 'senior_developer'].includes(r);
};

permissionSchema.statics.canCreateCommunity = function (role) {
  const r = normalize(role);
  return ['rising_star', 'legend', 'admin', 'moderator', 'junior_developer', 'senior_developer'].includes(r);
};

permissionSchema.statics.canAssignRoles = function (role) {
  const r = normalize(role);
  return ['admin', 'senior_developer'].includes(r);
};

permissionSchema.statics.canRevoke = function (role) {
  const r = normalize(role);
  return ['admin', 'senior_developer'].includes(r);
};

permissionSchema.statics.canSuspend = function (role) {
  const r = normalize(role);
  return ['moderator', 'junior_developer', 'senior_developer'].includes(r);
};

// Compare ranks: acting user must outrank target
permissionSchema.statics.canAffect = function (targetRole, actingRole) {
  const actor = normalize(actingRole);
  const target = normalize(targetRole);
  const actorRank = rankOrder.indexOf(actor);
  const targetRank = rankOrder.indexOf(target);
  return actorRank > targetRank;
};

// --------------------------------------------
// SEED: Generate or refresh default permission entries
// --------------------------------------------
permissionSchema.statics.seedDefaults = async function () {
  const Permission = this;

  const defaults = {
    unverified: { canPost: false },
    verified: { canPost: true },
    rising_star: { canPost: true, canCreateCommunity: true },
    legend: { canPost: true, canCreateCommunity: true },
    admin: {
      canPost: true,
      canApprove: true,
      canCreateCommunity: true,
      canAssignRoles: true,
      canRevoke: true,
      canSuspend: true,
    },
    moderator: {
      canPost: true,
      canApprove: true,
      canCreateCommunity: true,
      canAssignRoles: true,
      canRevoke: true,
      canSuspend: true,
    },
    junior_developer: {
      canPost: true,
      canApprove: true,
      canCreateCommunity: true,
      canAssignRoles: true,
      canRevoke: true,
      canSuspend: true,
    },
    senior_developer: {
      canPost: true,
      canApprove: true,
      canCreateCommunity: true,
      canAssignRoles: true,
      canRevoke: true,
      canSuspend: true,
    },
  };

  for (const [role, values] of Object.entries(defaults)) {
    await Permission.updateOne(
      { role },
      { $set: { role, ...values } },
      { upsert: true }
    );
  }

  console.log('[Permissions] Default roles seeded successfully.');
};

// --------------------------------------------
// MODEL EXPORT
// --------------------------------------------
const Permission = mongoose.model('Permission', permissionSchema);
module.exports = Permission;
