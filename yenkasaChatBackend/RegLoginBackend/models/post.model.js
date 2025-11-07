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
    required: false,
    index: true
  },

  communityName: {
    type: String,
    trim: true,
    default: ''
  },

  // Post type (text, image, video, audio, etc.)
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'poll', 'link'],
    default: 'text'
  },

  // Content
  text: {
    type: String,
    trim: true,
    maxlength: 5000,
    default: ''
  },

  // 🖼️ Media fields (only one type used per post)
  imageUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },

  // Engagement
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },

  // Post status and visibility
  isActive: { type: Boolean, default: true },
  isPinned: { type: Boolean, default: false },
  pinnedUntil: { type: Date, default: null },

  // Moderation / Approval
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isReported: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 },

  // Visibility
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },

  // Mentions and tags
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  tags: [String],

  // Location (optional)
  location: { type: String, default: '' },

  // Coins earned from this post
  coinsEarned: { type: Number, default: 0 }

}, { timestamps: true });

/* ------------------------------------
 * ⚡ Indexes
 * ------------------------------------ */
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ communityId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likeCount: -1 });

/* ------------------------------------
 * ⚙️ Instance Methods
 * ------------------------------------ */
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

/* ------------------------------------
 * 🧠 Static Helpers
 * ------------------------------------ */
postSchema.statics.findApproved = function (filter = {}) {
  return this.find({ ...filter, status: 'approved', isActive: true });
};

postSchema.statics.findPending = function () {
  return this.find({ status: 'pending' });
};

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
