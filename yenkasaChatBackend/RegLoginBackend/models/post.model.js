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

  // Community
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
    index: true
  },

  // Post type
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'poll', 'link'],
    default: 'text'
  },

  // Content
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },

  // Media (single or multiple)
  imageUrl: {
    type: String,
    default: ''
  },
  videoUrl: {
    type: String,
    default: ''
  },
  mediaUrls: [{
    type: String,
    default: ''
  }],

  // Engagement
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  likeCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },

  // Post status and visibility
  isActive: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedUntil: {
    type: Date,
    default: null
  },

  // Moderation
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  },

  // Visibility
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },

  // Mentions (users tagged)
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Tags/Categories
  tags: [String],

  // Location (optional)
  location: {
    type: String,
    default: ''
  },

  // Coins earned from this post
  coinsEarned: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

// Indexes for performance
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ communityId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likeCount: -1 });

// Check if user liked post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

// Efficient add like
postSchema.methods.addLike = async function(userId) {
  const result = await mongoose.model('Post').updateOne(
    { _id: this._id, likes: { $ne: userId } },
    { $addToSet: { likes: userId }, $inc: { likeCount: 1 } }
  );
  return result.modifiedCount > 0;
};

// Efficient remove like
postSchema.methods.removeLike = async function(userId) {
  const result = await mongoose.model('Post').updateOne(
    { _id: this._id, likes: userId },
    { $pull: { likes: userId }, $inc: { likeCount: -1 } }
  );
  return result.modifiedCount > 0;
};

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
