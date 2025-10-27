const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // 👤 Author of the post
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // 🏘️ Belongs to a specific community (new)
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },

  // 📝 Core content
  caption: { type: String, trim: true },
  mediaType: { 
    type: String, 
    enum: ['text', 'image', 'video', 'audio', 'voice'], 
    required: true 
  },
  mediaUrl: { type: String },
  thumbnailUrl: { type: String },

  // ❤️ Engagement stats
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },

  // 🛡️ Moderation & integrity
  isDeleted: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: true }, // moderators can toggle this
  reports: { type: Number, default: 0 }, // number of user reports
  flaggedReason: { type: String }, // e.g., "pornographic", "spam", "hate"

  // 🪙 Reward system (future use with Yenkasa Coins)
  engagementScore: { type: Number, default: 0 }, // helps calculate coins
  rewarded: { type: Boolean, default: false }, // if already rewarded for engagement

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


// Auto-populate user basic fields and community info on all find queries
function autoPopulateRefs(next) {
  this.populate('user', '_id username profileImage')
      .populate('community', '_id name locationTag');
  next();
}
postSchema.pre(/^find/, autoPopulateRefs);


// Keep likesCount in sync defensively
postSchema.pre('save', function(next) {
  if (Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }
  next();
});


/**
 * Atomic toggle helper for likes — remains unchanged
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


// 🧭 Helpful indexes for performance
postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1 });
postSchema.index({ community: 1 });
postSchema.index({ engagementScore: -1 });

module.exports = mongoose.model('Post', postSchema);
