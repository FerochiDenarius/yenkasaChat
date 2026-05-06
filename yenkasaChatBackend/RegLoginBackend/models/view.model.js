const mongoose = require('mongoose');

const viewSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    activityId: {
      type: String,
      unique: true,
      required: true
    },
    username: {
      type: String,
      default: ''
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },

    // <-- THIS WAS BROKEN. FIXED NOW.
    viewsCount: {
      type: Number,
      default: 0
    },

    watchDuration: {
      type: Number,
      default: 0
    },
    qualifiedView: {
      type: Boolean,
      default: false,
      index: true
    },
    monetizableOpportunity: {
      type: Boolean,
      default: false,
      index: true
    },
    ipAddress: {
      type: String,
      default: ''
    },
    deviceId: {
      type: String,
      default: ''
    },

    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio', 'text', 'unknown'],
      default: 'unknown'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('View', viewSchema);
