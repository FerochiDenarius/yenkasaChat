const mongoose = require('mongoose');

const liveStreamSchema = new mongoose.Schema(
  {
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    hostUsername: {
      type: String,
      required: true,
      trim: true
    },
    hostAvatar: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    thumbnail: {
      type: String,
      default: ''
    },
    community: {
      type: String,
      default: '',
      trim: true
    },
    agoraChannel: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    isLive: {
      type: Boolean,
      default: true,
      index: true
    },
    viewerCount: {
      type: Number,
      default: 0,
      min: 0
    },
    peakViewerCount: {
      type: Number,
      default: 0,
      min: 0
    },
    hostRole: {
      type: String,
      default: ''
    },
    maxDurationMinutes: {
      type: Number,
      default: null
    },
    scheduledEndAt: {
      type: Date,
      default: null
    },
    endReason: {
      type: String,
      default: ''
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    endedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

liveStreamSchema.index({ isLive: 1, startedAt: -1 });
liveStreamSchema.index({ hostId: 1, isLive: 1 });

module.exports = mongoose.model('LiveStream', liveStreamSchema);
