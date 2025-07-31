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
    // Consider adding 'select: false' for security if not selecting explicitly elsewhere
    // select: false
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
    // Consider adding 'select: false'
    // select: false
  },
  codeExpiresAt: {
    type: Date
  },
  profileImage: {
    type: String,
    default: ''
  },
  playerId: {
    type: String,
    default: null
  },
  refreshToken: {
    type: String
    // Consider adding 'select: false'
    // select: false
  }
}, { timestamps: true });



const User = mongoose.model('User', userSchema);
module.exports = User;
