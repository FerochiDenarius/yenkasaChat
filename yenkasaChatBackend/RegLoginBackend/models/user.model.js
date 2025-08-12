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
    sparse: true // Allows multiple documents to have a null value for this unique field
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    sparse: true, // Allows multiple documents to have a null value for this unique field
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  password: {
    type: String,
    required: true
    // Consider adding 'select: false' for security if not selecting explicitly elsewhere
    // select: false
  },
  location: { // Consider if a more structured location object is needed (e.g., GeoJSON)
    type: String, // Or Object with lat/lng
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
    default: '' // Or a default placeholder image URL
  },
  oneSignalPlayerId: { // ✅ CORRECTED FIELD NAME
    type: String,
    default: null // Explicitly setting default to null is good
  },
  refreshToken: {
    type: String
   
  }
  
}, { timestamps: true }); // timestamps adds createdAt and updatedAt


// Indexing for common query fields can improve performance
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });


const User = mongoose.model('User', userSchema);
module.exports = User;
