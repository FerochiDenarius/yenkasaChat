// File: models/User.js

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
  verificationCode: {
    type: String
  },
  codeExpiresAt: {
    type: Date
  },
  profileImage: {
    type: String,
    default: '' 
  },
  playerId: { // ✅ CORRECTED TO playerId AS AGREED
    type: String,
    default: null 
  },
  refreshToken: {
    type: String
  }
  
}, { timestamps: true }); 


userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });


const User = mongoose.model('User', userSchema);
module.exports = User;
