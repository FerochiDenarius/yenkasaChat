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
      default: false,
      index: true
    },
    lifecycleStatus: {
      type: String,
      enum: ['starting', 'live', 'ended', 'failed'],
      default: 'starting',
      index: true
    },
    hostConnected: {
      type: Boolean,
      default: false,
      index: true
    },
    hostSocketId: {
      type: String,
      default: ''
    },
    hostJoinedAt: {
      type: Date,
      default: null
    },
    hostLastSeenAt: {
      type: Date,
      default: null
    },
    startupExpiresAt: {
      type: Date,
      default: null,
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
    likeCount: {
      type: Number,
      default: 0,
      min: 0
    },
    guests: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        avatar: String,
        agoraUid: Number,
        isMuted: { type: Boolean, default: false },
        isVideoStopped: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now }
      }
    ],
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

liveStreamSchema.index({ isLive: 1, lifecycleStatus: 1, hostConnected: 1, startedAt: -1 });
liveStreamSchema.index({ hostId: 1, isLive: 1 });

module.exports = mongoose.model('LiveStream', liveStreamSchema);
