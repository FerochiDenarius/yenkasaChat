const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const coinTransactionSchema = new Schema({
  fromUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  toUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // 🪪 Identifying info for audit and traceability
  fromUsername: { type: String, default: '' },
  toUsername: { type: String, default: '' },
  fromWalletId: { type: String, default: '' },
  toWalletId: { type: String, default: '' },

  amount: {
    type: Number,
    required: true
  },

  // 🎯 Transaction category
  type: {
    type: String,
enum: [
  // POST REWARDS
  "REWARD_POST",
  "REWARD_POST_APPROVED",   // ★ NEW → for approved posts
  "REWARD_POST_REJECTED",   // ★ NEW → for rejected posts
  "REWARD_POST_LIKE",
  "REWARD_POST_LIKE_RECEIVED",
  "REWARD_POST_COMMENT_RECEIVED",

  // COMMENT SYSTEM
  "REWARD_COMMENT",
  "REWARD_COMMENT_LIKE",
  "REWARD_REPLY",

  // FOLLOWERS
  "REWARD_FOLLOW",
   "REWARD_FOLLOW_RECEIVED", 

  // VIEWS
  "REWARD_VIEWS",              // ad views
  "REWARD_POST_VIEW_1000",
  "REWARD_POST_VIEW",          // user viewing post
  "REWARD_IMAGE_VIEW",
  "REWARD_TEXT_VIEW",
  "REWARD_SHORT_VIDEO_VIEW",
  "REWARD_AUDIO_VIEW",
  "REWARD_WATCH_TIME_10_MIN",
  "REWARD_LONG_WATCH",
  "REWARD_POST_SINGLE_VIEW_RECEIVED",
  "REWARD_POST_VIEW_RECEIVED", // owner receives a view
  "REWARD_MILESTONE",          // high engagement reward

	  // COMMUNITY
	  "REWARD_JOIN_COMMUNITY",
	  "REWARD_CREATE_COMMUNITY",
	  "REWARD_COMMUNITY_APPROVED",

  // SYSTEM
  "REWARD_VERIFICATION",
  "REWARD_ACCOUNT_AGE",
  "REWARD_DAILY_LOGIN",
  "REWARD_CONVERSATION_STREAK",

  // Generic / Other
  "TRANSFER",
  "PURCHASE",
  "REFUND",
  "BONUS",
  "LIVE_GIFT",
  "ADMIN_ADJUSTMENT"
],


    required: true
  },

  description: { type: String, default: '' },

  relatedPostId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },

  relatedCommentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },

  // 🎯 Optional for now, will enforce later
  activityId: { type: String, default: null, index: true },

  // 🔑 Unique transaction ID (used as external reference)
  transactionId: {
    type: String,
    unique: true,
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'completed'
  },

  fromUserBalanceBefore: Number,
  fromUserBalanceAfter: Number,
  toUserBalanceBefore: Number,
  toUserBalanceAfter: Number,

  adminNote: { type: String, default: '' }
}, { timestamps: true });

// 🧭 Helpful indexes
coinTransactionSchema.index({ toUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ fromUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ type: 1 });
coinTransactionSchema.index({ status: 1 });

// 🔹 Static helper to get visible transactions (only with activityId)
coinTransactionSchema.statics.getVisibleTransactionsForUser = function(userId) {
  return this.find({
    $or: [{ toUserId: userId }, { fromUserId: userId }],
    activityId: { $ne: null } // enforce display rule
  }).sort({ createdAt: -1 });
};

module.exports =
  mongoose.models.CoinTransaction ||
  mongoose.model('CoinTransaction', coinTransactionSchema);
