const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'ChatRoom'
  },

  // Backward-compatible alias used by older clients for the same chat room id.
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    ref: 'ChatRoom',
    index: true
  },

  // Keep this a string for API stability (your clients expect string id)
  senderId: {
    type: String,
    required: true
  },

  text: { type: String, required: false },

  messageType: {
    type: String,
    enum: ['message', 'laugh_reaction'],
    default: 'message',
    index: true
  },

  repliedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: false,
    default: null
  },

  imageUrl: { type: String, required: false },
  audioUrl: { type: String, required: false },
  videoUrl: { type: String, required: false },
  fileUrl: { type: String, required: false },
  contactInfo: { type: String, required: false },

  location: {
    type: {
      latitude: Number,
      longitude: Number
    },
    required: false
  },

  timestamp: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },

  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Virtual `sender` field:
 * - Adds a `sender` object on output (username, profileImage, _id)
 * - Keeps `senderId` (string) untouched for backwards compatibility
 */
messageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'username profileImage _id' }
});

/**
 * Also create a virtual for the repliedTo.message.sender so we can populate nested sender
 * We'll populate 'repliedTo' normally (it remains an ObjectId ref to Message),
 * and after that, the repliedTo's `sender` virtual will be resolvable.
 */

/**
 * Auto-populate hook for queries:
 * - populate repliedTo message and also populate the virtual `sender` for this message
 * - populate virtual `sender` on repliedTo by path populate
 */
function autoPopulate(next) {
  this.populate({ path: 'sender' })
    .populate({
      path: 'repliedTo',
      populate: { path: 'sender', select: 'username profileImage _id' }
    });
  next();
}

// run for find, findOne, findOneAndUpdate, findById, etc.
messageSchema.pre(/^find/, autoPopulate);

module.exports = mongoose.model('Message', messageSchema);
