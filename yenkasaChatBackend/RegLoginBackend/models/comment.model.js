// models/comment.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  // Post reference
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  
  // Author
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Content
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  // Optional image in comment
  imageUrl: {
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
  
  // Reply to another comment (nested comments)
  parentCommentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  replyCount: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Moderation
  isReported: {
    type: Boolean,
    default: false
  },
  
  reportCount: {
    type: Number,
    default: 0
  }
  
}, { timestamps: true });

// Indexes
commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ userId: 1, createdAt: -1 });
commentSchema.index({ parentCommentId: 1 });

// Method to check if user has liked the comment
commentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

// Method to add like
commentSchema.methods.addLike = async function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push(userId);
    this.likeCount += 1;
    await this.save();
    return true;
  }
  return false;
};

// Method to remove like
commentSchema.methods.removeLike = async function(userId) {
  const index = this.likes.findIndex(id => id.toString() === userId.toString());
  if (index !== -1) {
    this.likes.splice(index, 1);
    this.likeCount = Math.max(0, this.likeCount - 1);
    await this.save();
    return true;
  }
  return false;
};

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;