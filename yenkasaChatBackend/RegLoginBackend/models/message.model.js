const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'ChatRoom'
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId, // ✅ CHANGED: Must be ObjectId
    ref: 'User',                         // ✅ ADDED: Must reference the User model
    required: true
  },
  text: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  },
  audioUrl: {
    type: String,
    required: false
  },
  videoUrl: {
    type: String,
    required: false
  },
  fileUrl: {
    type: String,
    required: false
  },
  contactInfo: { // Consider if this should be a structured object
    type: String, 
    required: false
  },
  location: { // This structure is fine
    type: {
      latitude: Number,
      longitude: Number
    },
    required: false
  },
  // timestamp: { // You have `timestamps: true` which adds `createdAt` and `updatedAt`
  //   type: Date, // If you keep this custom 'timestamp', it's separate from 'createdAt'
  //   default: Date.now
  // },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
}, {
  timestamps: true // This adds `createdAt` and `updatedAt`.
                  // Your client uses 'createdAt' via @SerializedName("createdAt") val timestamp
});

// Important: Ensure your User model is registered as 'User'
// e.g., module.exports = mongoose.model('User', userSchema);

module.exports = mongoose.model('Message', messageSchema);

