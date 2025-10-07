const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'ChatRoom'
  },
  senderId: {
    type: String, // ✅ still String for compatibility with your current setup
    required: true
  },
  text: {
    type: String,
    required: false
  },

  // ✅ Proper reply-to field (matches frontend key `repliedTo`)
  repliedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message', // Self-reference to another message
    required: false,
    default: null
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
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// ✅ Auto-populate sender + repliedTo message when querying
messageSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'senderId',
    select: 'username profileImage _id'
  }).populate({
    path: 'repliedTo',
    populate: {
      path: 'senderId',
      select: 'username profileImage _id'
    }
  });
  next();
});

module.exports = mongoose.model('Message', messageSchema);
