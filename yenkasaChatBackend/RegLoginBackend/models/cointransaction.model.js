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
      'REWARD_POST',
      'REWARD_POST_LIKE',
      'REWARD_COMMENT',
      'REWARD_COMMENT_LIKE',
      'REWARD_FOLLOW',
      'REWARD_VIEWS',
      'REWARD_VERIFICATION',
      'REWARD_ACCOUNT_AGE',
      'REWARD_DAILY_LOGIN',
      'TRANSFER',
      'PURCHASE',
      'REFUND',
      'BONUS',
      'ADMIN_ADJUSTMENT'
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
