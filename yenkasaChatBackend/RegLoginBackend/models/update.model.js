const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200
    },
    category: {
      type: String,
      enum: [
        'announcement',
        'livestream',
        'rewards',
        'ranking',
        'creator',
        'community',
        'feature',
        'app_update'
      ],
      default: 'announcement',
      index: true
    },
    mediaType: {
      type: String,
      enum: ['text', 'image', 'video', 'live', 'link'],
      default: 'text'
    },
    thumbnailUrl: {
      type: String,
      default: ''
    },
    videoUrl: {
      type: String,
      default: ''
    },
    targetType: {
      type: String,
      default: 'system'
    },
    targetId: {
      type: String,
      default: ''
    },
    targetUrl: {
      type: String,
      default: ''
    },
    deepLinkUrl: {
      type: String,
      default: ''
    },
    channelName: {
      type: String,
      default: 'Yenkasa Updates'
    },
    verifiedBadge: {
      type: Boolean,
      default: true
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true
    },
    authorType: {
      type: String,
      enum: ['system', 'admin', 'moderator'],
      default: 'system'
    },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    dedupeKey: {
      type: String,
      default: null,
      index: true,
      sparse: true
    },
    scheduledFor: {
      type: Date,
      default: null,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    },
    reactions: {
      fire: { type: Number, default: 0, min: 0 },
      heart: { type: Number, default: 0, min: 0 },
      clap: { type: Number, default: 0, min: 0 }
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

updateSchema.index({ pinned: -1, publishedAt: -1 });

module.exports = mongoose.model('Update', updateSchema);
