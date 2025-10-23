const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String },
  mediaType: { type: String, enum: ['text', 'image', 'video', 'audio'], required: true },
  mediaUrl: { type: String },
  thumbnailUrl: { type: String },

  // array of user ObjectId who liked the post
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // denormalized count for quick access and to avoid counting the array repeatedly
  likesCount: { type: Number, default: 0 },

  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },

  // optional soft delete
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-populate user basic fields on all find queries
function autoPopulateUser(next) {
  // populate the 'user' field with id, username and profileImage
  this.populate('user', '_id username profileImage');
  next();
}
postSchema.pre(/^find/, autoPopulateUser);

// Keep likesCount in sync when saving (defensive; main updates should use atomic updates)
postSchema.pre('save', function(next) {
  if (Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }
  next();
});

/**
 * Atomic toggle helper: performs $addToSet/$pull + $inc in one operation.
 * Returns { likedByUser, likesCount } with server-authoritative values.
 */
postSchema.statics.toggleLike = async function (postId, userId) {
  if (!postId || !userId) throw new Error('postId and userId are required');

  const post = await this.findById(postId).select('likes likesCount');
  if (!post) throw new Error('Post not found');

  const alreadyLiked = post.likes.some(id => id.toString() === userId.toString());

  const update = alreadyLiked
    ? { $pull: { likes: userId }, $inc: { likesCount: -1 } }
    : { $addToSet: { likes: userId }, $inc: { likesCount: 1 } };

  const updated = await this.findByIdAndUpdate(postId, update, {
    new: true,
    runValidators: true
  }).select('likes likesCount');

  if (!updated) throw new Error('Failed to update like state');

  return {
    likedByUser: !alreadyLiked,
    likesCount: updated.likesCount
  };
};

// Useful indexes
postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1 });

module.exports = mongoose.model('Post', postSchema);