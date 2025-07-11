const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,   // 🔽 Always lowercase
    trim: true         // ✂️ Remove spaces
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true          // ✂️ Remove spaces
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  location: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String
  },
  codeExpiresAt: {
    type: Date
  },
  profileImage: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
