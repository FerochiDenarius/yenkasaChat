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
// In your user.model.js
    // ...
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    // ...
  // 🔑 Legacy generic fields
  verificationCode: { type: String },
  codeExpiresAt: { type: Date },

  // 📧 Email verification
  emailVerified: { type: Boolean, default: false },
  emailVerificationCode: { type: String },
  emailCodeExpiresAt: { type: Date },

  // 📱 Phone verification
  phoneVerified: { type: Boolean, default: false },
  phoneVerificationCode: { type: String },
  phoneCodeExpiresAt: { type: Date },

  profileImage: {
    type: String,
    default: '' 
  },

  playerId: { 
    type: String,
    default: null 
  },

  refreshToken: { type: String },

  // 🔒 Password reset fields (required for forgot/reset password flow)
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date }

}, { timestamps: true }); 

userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
