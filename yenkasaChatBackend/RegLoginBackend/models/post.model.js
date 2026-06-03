const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
  // Author info
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Community (linked + readable name)
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'Community',
    index: true
  },

  communityName: {
    type: String,
    trim: true,
    default: ''
  },

  clientRequestId: {
    type: String,
    trim: true,
    default: ''
  },

  // Post type
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'poll', 'link'],
    default: 'text'
  },

  // Caption / text
  text: {
    type: String,
    trim: true,
    maxlength: 5000,
    default: ''
  },

  textBackgroundColor: {
    type: String,
    trim: true,
    default: ''
  },

  // Media fields
  imageUrl: { type: String, default: '' },
  imageUrls: [{ type: String }],
  videoUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },

  // Engagement
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  rewardedLikeUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  saveCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },

  // ⭐ NEW: Foreign object references
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],

  views: [{
    type: Schema.Types.ObjectId,
    ref: 'View'
  }],

  // Prepare for future likes/shares as objects:
  // likes: [{ type: Schema.Types.ObjectId, ref: "Like" }],
  // shares: [{ type: Schema.Types.ObjectId, ref: "Share" }],

  // Post status
  isActive: { type: Boolean, default: true },
  isPinned: { type: Boolean, default: false },
  pinnedUntil: { type: Date, default: null },

  // Moderation
  status: {
    type: String,
    enum: ['pending', 'approved', 'pending_review', 'pending_scan', 'rejected'],
    default: 'pending'
  },

  aiModeration: {
    type: Object,
    default: null
  },

  aiModerationRef: {
    type: Schema.Types.ObjectId,
    ref: 'AiModeration',
    default: null,
    index: true
  },

  isReported: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 },

  // NEW: Flags (Reports)
  flags: [
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      reason: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  // Visibility
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },

  // Mentions + Tags
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  tags: [String],

  // Location
  location: { type: String, default: '' },

  // Coins earned
  coinsEarned: { type: Number, default: 0 }

}, { timestamps: true });


// Indexes
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ communityId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likeCount: -1 });
postSchema.index({ viewCount: -1, commentCount: -1, createdAt: -1 });
postSchema.index({ status: 1, isActive: 1, createdAt: -1 });
postSchema.index({ status: 1, isActive: 1, userId: 1, createdAt: -1 });
postSchema.index({ status: 1, isActive: 1, communityId: 1, createdAt: -1 });
postSchema.index(
  { userId: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientRequestId: { $type: 'string', $gt: '' } }
  }
);
postSchema.index({
  status: 1,
  isActive: 1,
  viewCount: -1,
  commentCount: -1,
  shareCount: -1,
  saveCount: -1,
  likeCount: -1,
  createdAt: -1
});
postSchema.index({ text: 'text', tags: 'text', communityName: 'text' });


// Methods
postSchema.methods.isLikedBy = function (userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

postSchema.methods.addLike = async function (userId) {
  const result = await mongoose.model('Post').updateOne(
    { _id: this._id, likes: { $ne: userId } },
    { $addToSet: { likes: userId }, $inc: { likeCount: 1 } }
  );
  return result.modifiedCount > 0;
};

postSchema.methods.removeLike = async function (userId) {
  const result = await mongoose.model('Post').updateOne(
    { _id: this._id, likes: userId },
    { $pull: { likes: userId }, $inc: { likeCount: -1 } }
  );
  return result.modifiedCount > 0;
};


// Static helpers
postSchema.statics.findApproved = function (filter = {}) {
  return this.find({ ...filter, status: 'approved', isActive: true });
};

postSchema.statics.findPending = function () {
  return this.find({ status: { $in: ['pending', 'pending_review', 'pending_scan'] } });
};

// Static helper: record a view
postSchema.statics.addView = async function (postId, viewId) {
  return this.findByIdAndUpdate(
    postId,
    {
      $addToSet: { views: viewId },
      $inc: { viewCount: 1 }
    },
    { new: true }
  );
};




// EXPORT MODEL
const Post = mongoose.model("Post", postSchema);
module.exports = Post;
