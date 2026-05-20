const mongoose = require('mongoose');

const announcementMediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'file'],
      required: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    thumbnail: {
      type: String,
      default: '',
      trim: true
    },
    filename: {
      type: String,
      default: '',
      trim: true
    },
    size: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    authorUsername: {
      type: String,
      required: true,
      trim: true
    },
    authorRole: {
      type: String,
      required: true,
      trim: true
    },
    media: {
      type: [announcementMediaSchema],
      default: []
    },
    audience: {
      type: String,
      enum: ['all', 'verified', 'admins', 'moderators', 'developers', 'community'],
      default: 'all',
      index: true
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      default: null
    },
    communityName: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published'],
      default: 'published',
      index: true
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    targetUrl: {
      type: String,
      default: '',
      trim: true
    },
    deepLinkUrl: {
      type: String,
      default: '',
      trim: true
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0
    },
    viewedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      select: false,
      default: []
    },
    likedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      select: false,
      default: []
    },
    notificationsDispatchedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

announcementSchema.index({ isPinned: -1, publishedAt: -1, createdAt: -1 });
announcementSchema.index({ audience: 1, status: 1, scheduledAt: 1 });
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
