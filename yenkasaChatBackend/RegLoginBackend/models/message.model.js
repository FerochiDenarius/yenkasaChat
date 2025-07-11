const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'ChatRoom'
  },
  senderId: {
    type: String,
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
  contactInfo: {
    type: String,
    required: false
  },
  location: {
    type: {
      latitude: Number,
      longitude: Number
    },
    required: false
  },
  timestamp: { // ✅ This is your custom field — optional, but now valid
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
}, {
  timestamps: true // ✅ Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Message', messageSchema);
