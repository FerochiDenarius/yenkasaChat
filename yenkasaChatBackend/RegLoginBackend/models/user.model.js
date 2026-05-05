const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({

  // ===============================
  // 🆔 IDENTITY
  // ===============================
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },

  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    sparse: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },

  phoneNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true
  },

  password: {
    type: String,
    required: true
  },

  // ===============================
  // 🌍 LOCATION
  // ===============================
  country: {
    type: String,
    enum: [
      "Ghana", "Nigeria", "Kenya", "South Africa", "Uganda", "Cameroon",
      "Tanzania", "Ethiopia", "Rwanda", "Senegal", "Ivory Coast", "Benin",
      "Togo", "Gambia", "Zambia", "Zimbabwe", "Botswana", "Namibia",
      "Malawi", "Sierra Leone", "Liberia", "Burkina Faso", "Niger",
      "Mauritius", "Morocco", "Algeria", "Tunisia", "Egypt", "Sudan",
      "Somalia", "Mozambique", "Angola", "Mali", "Guinea", "DR Congo",
      "Congo", "Chad", "Equatorial Guinea", "Cape Verde", "Eritrea",
      "Lesotho", "Eswatini", "Madagascar", "Seychelles", "South Sudan"
    ],
    default: "Ghana"
  },

  location: { type: String, default: '' },
  community: { type: Schema.Types.ObjectId, ref: 'Community', default: null },

  joinedCommunities: [{
    type: Schema.Types.ObjectId,
    ref: 'Community'
  }],

  // ===============================
  // 🛡️ VERIFICATION FLAGS
  // ===============================
  verified: { type: Boolean, default: false }, // general / legacy
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },

  // ===============================
  // 📧 EMAIL VERIFICATION (FIXED)
  // ===============================
  emailVerificationCode: String,          // hashed
  emailVerificationExpires: Date,
  emailVerificationCooldown: Date,
  emailVerificationAttempts: {
    type: Number,
    default: 0
  },

  // ===============================
  // 📱 PHONE VERIFICATION (UNCHANGED)
  // ===============================
  phoneVerificationCode: String,
  phoneCodeExpiresAt: Date,

  // ===============================
  // 🧍‍♂️ PROFILE
  // ===============================
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '' },

  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say', ''],
    default: ''
  },

  dateOfBirth: {
    type: String, // YYYY-MM-DD
    default: ''
  },

  // ===============================
  // 🧑‍⚖️ ROLES & PERMISSIONS
  // ===============================
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Permission',
    default: null,
  },

  roleName: {
    type: String,
    default: 'unverified'
  },

  // ===============================
  // 👥 SOCIAL
  // ===============================
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },

  // ===============================
  // 💰 WALLET & STATS
  // ===============================
  coinsBalance: { type: Number, default: 0 },

  walletId: {
    type: String,
    unique: true,
    default: () =>
      `YKC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  },

  // ===============================
  // 🏅 PLATFORM VERIFICATION
  // ===============================
  verificationPhase: {
    type: String,
    enum: ['promotion', 'standard', 'growth'],
    default: 'promotion'
  },

  verificationBanner: { type: String, default: null },
  verificationScore: { type: Number, default: 0 },

  // ===============================
  // 🔐 AUTH & SYSTEM
  // ===============================
  refreshToken: { type: String },

  suspendedUntil: { type: Date, default: null },

  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  passwordResetToken: String,
  passwordResetExpires: Date,

  notificationPreferences: {
    inAppEnabled: { type: Boolean, default: true },
    rewardEnabled: { type: Boolean, default: true }
  },

  timezone: { type: String, default: 'UTC' },

  conversationStreak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null }
  },

  playerId: { type: String, default: null }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
