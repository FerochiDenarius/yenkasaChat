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

    // 🕒 new field: watch duration in seconds
    watchDuration: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Optional: prevent identical rapid-fire inserts
viewSchema.index({ postId: 1, userId: 1, viewedAt: 1 });

module.exports = mongoose.model('View', viewSchema);
