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
  location: { 
    type: String, 
    default: ''
  },
  verified: {
    type: Boolean,
    default: false
  },

  // 🧍‍♂️ Profile fields
  profileImage: { type: String, default: '' },
  bio: { type: String, default: '' },

  // 🧑‍🤝‍🧑 Social graph
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },

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

  playerId: { type: String, default: null }

}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
