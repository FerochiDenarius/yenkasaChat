const mongoose = require('mongoose');

const viewSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// ✅ Removed unique index so each view is counted
// viewSchema.index({ post: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('View', viewSchema);
