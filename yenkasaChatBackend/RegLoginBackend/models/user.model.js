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

  // 🌍 AFRICA-WIDE COUNTRY SUPPORT (Ghana-only active for now)
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

  // 🌍 Optional location + primary community
  location: { type: String, default: '' },
  community: { type: Schema.Types.ObjectId, ref: 'Community', default: null },

  // 👥 Joined communities (multi-membership)
  joinedCommunities: [{
    type: Schema.Types.ObjectId,
    ref: 'Community'
  }],

  verified: { type: Boolean, default: false },

  // 🧍‍♂️ Profile fields
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '' },

  // ===============================
  // ROLE FIELDS
  // ===============================

  role: {
    type: Schema.Types.ObjectId,
    ref: 'Permission',
    default: null,
  },

  roleName: {
    type: String,
    default: "user"
  },

  // ===============================

  // 🕓 Suspension
  suspendedUntil: { type: Date, default: null },

  // 🧑‍🤝‍🧑 Social graph
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },

  // 💰 Yenkasa coins
  coinsBalance: { type: Number, default: 0 },

  // 🪙 Wallet system
  walletId: {
    type: String,
    unique: true,
    default: () =>
      `YKC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  },

  // 🧾 Verification
  verificationPhase: {
    type: String,
    enum: ['promotion', 'standard', 'growth'],
    default: 'promotion',
  },
  verificationBanner: { type: String, default: null },
  verificationScore: { type: Number, default: 0 },

  // 🔒 Auth fields
  refreshToken: { type: String },

  // 🕓 Online status
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


// ===============================
// METHODS
// ===============================

userSchema.methods.localCommunityId = function() {
  return this.community;
};

userSchema.methods.additionalCommunities = function() {
  return this.joinedCommunities.filter(
    c => c.toString() !== this.community?.toString()
  );
};

userSchema.methods.canJoinMoreCommunities = function() {
  return this.joinedCommunities.length < 3;
};

module.exports = mongoose.model('User', userSchema);
