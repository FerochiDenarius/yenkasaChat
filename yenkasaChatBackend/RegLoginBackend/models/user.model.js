// models/user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  phoneNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true 
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    sparse: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  password: {
    type: String,
    required: true
  },

  // 🌍 Optional location + community
  location: { type: String, default: '' },
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null },

  verified: { type: Boolean, default: false },

  // 🧍‍♂️ Profile fields
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '' },

  // 🔑 Roles & permissions
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'developer'],
    default: 'user'
  },

  permissions: {
    canPost: { type: Boolean, default: false },
    canApprovePost: { type: Boolean, default: false },
    canRevokeAdmin: { type: Boolean, default: false },
    canSuspendUser: { type: Boolean, default: false },
    canAssignRoles: { type: Boolean, default: false } // mainly developer
  },

  // 🕓 Suspension
  suspendedUntil: { type: Date, default: null }, // null = not suspended

  // 🧑‍🤝‍🧑 Social graph
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },

  // 💰 Yenkasa Coins system
  coinsBalance: { type: Number, default: 0 },

  // 🪙 Future-ready wallet system
  walletId: {
    type: String,
    unique: true,
    default: () =>
      `YKC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  },

  verificationPhase: {
    type: String,
    enum: ['promotion', 'standard', 'growth'],
    default: 'promotion',
  },
  verificationBanner: { type: String, default: null },
  verificationScore: { type: Number, default: 0 },

  // 🔒 Auth fields
  refreshToken: { type: String },

  // 🕓 Online tracking
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  // Verification fields
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  verificationCode: String,
  codeExpiresAt: Date,
  emailVerificationCode: String,
  emailCodeExpiresAt: Date,
  phoneVerificationCode: String,
  phoneCodeExpiresAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // 🔔 Push notifications
  playerId: { type: String, default: null }

}, { timestamps: true });

// ⚡ Middleware: auto-set permissions based on role
userSchema.pre('save', function(next) {
  switch (this.role) {
    case 'developer':
      this.permissions = {
        canPost: true,
        canApprovePost: true,
        canRevokeAdmin: true,
        canSuspendUser: true,
        canAssignRoles: true
      };
      break;

    case 'admin':
      this.permissions = {
        canPost: true,
        canApprovePost: true,
        canRevokeAdmin: false,
        canSuspendUser: false,
        canAssignRoles: false
      };
      break;

    case 'moderator':
      this.permissions = {
        canPost: true,
        canApprovePost: true,
        canRevokeAdmin: true,
        canSuspendUser: true,
        canAssignRoles: false
      };
      break;

    case 'user':
    default:
      this.permissions = {
        canPost: false,
        canApprovePost: false,
        canRevokeAdmin: false,
        canSuspendUser: false,
        canAssignRoles: false
      };
      break;
  }

  // ⚠️ If suspended, override canPost
  if (this.suspendedUntil && this.suspendedUntil > new Date()) {
    this.permissions.canPost = false;
  }

  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
