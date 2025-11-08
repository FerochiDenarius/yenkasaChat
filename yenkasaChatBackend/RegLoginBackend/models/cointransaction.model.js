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

  // 🪪 Add identifying info for audits
  fromUsername: { type: String, default: '' },
  toUsername: { type: String, default: '' },
  fromWalletId: { type: String, default: '' },
  toWalletId: { type: String, default: '' },

  amount: {
    type: Number,
    required: true
  },

  // 🎯 Expanded reward type list
  type: {
    type: String,
    enum: [
      'REWARD_POST',            // Reward for creating a post
      'REWARD_POST_LIKE',       // Reward for receiving a like on a post
      'REWARD_COMMENT',         // Reward for commenting
      'REWARD_COMMENT_LIKE',    // Reward for receiving a like on a comment
      'REWARD_FOLLOW',          // Reward for following another user
      'REWARD_VIEWS',
      'REWARD_VERIFICATION',    // Reward for verifying account
      'REWARD_ACCOUNT_AGE',     // ✅ Reward for Yenkasa account age/milestone
      'REWARD_DAILY_LOGIN',     // ✅ Reward for daily login streak/bonus
      'TRANSFER',               // Manual user transfer
      'PURCHASE',               // Purchase using coins
      'REFUND',                 // Refund for a transaction
      'BONUS',                  // Admin bonus or promotion
      'ADMIN_ADJUSTMENT'        // Admin manual change
    ],
    required: true
  },

  description: {
    type: String,
    default: ''
  },

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

  activityId: {
    type: String,
    index: true,
    unique: false
  },

  transactionId: {
    type: String,
    unique: true
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

  adminNote: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// 🧭 Indexes
coinTransactionSchema.index({ toUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ fromUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ type: 1 });
coinTransactionSchema.index({ status: 1 });

module.exports =
  mongoose.models.CoinTransaction ||
  mongoose.model('CoinTransaction', coinTransactionSchema);
