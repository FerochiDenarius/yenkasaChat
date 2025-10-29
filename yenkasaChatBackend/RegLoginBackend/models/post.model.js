// models/post.model.js
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
  
  // Content
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Media
  imageUrl: {
    type: String,
    default: ''
  },
  videoUrl: {
    type: String,
    default: ''
  },
  
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
  
  // Post status
  isActive: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  
  // Moderation
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

// Method to check if user has liked the post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

// Method to add like
postSchema.methods.addLike = async function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push(userId);
    this.likeCount += 1;
    await this.save();
    return true;
  }
  return false;
};

// Method to remove like
postSchema.methods.removeLike = async function(userId) {
  const index = this.likes.findIndex(id => id.toString() === userId.toString());
  if (index !== -1) {
    this.likes.splice(index, 1);
    this.likeCount = Math.max(0, this.likeCount - 1);
    await this.save();
    return true;
  }
  return false;
};

const Post = mongoose.model('Post', postSchema);
module.exports = Post;