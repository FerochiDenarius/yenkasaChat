// models/cointransaction.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const coinTransactionSchema = new Schema({
  // From user (null for system rewards)
  fromUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // To user
  toUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Amount
  amount: {
    type: Number,
    required: true
  },
  
  // Transaction type
  type: {
    type: String,
    enum: [
      'REWARD_POST',
      'REWARD_FOLLOW',
      'REWARD_LIKE',
      'REWARD_COMMENT',
      'REWARD_VERIFICATION',
      'TRANSFER',
      'PURCHASE',
      'REFUND',
      'BONUS',
      'ADMIN_ADJUSTMENT'
    ],
    required: true
  },
  
  // Description
  description: {
    type: String,
    default: ''
  },
  
  // Related entities (for tracking)
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
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'completed'
  },
  
  // Balance snapshots (for auditing)
  fromUserBalanceBefore: Number,
  fromUserBalanceAfter: Number,
  toUserBalanceBefore: Number,
  toUserBalanceAfter: Number,
  
  // Admin notes
  adminNote: {
    type: String,
    default: ''
  }
  
}, { timestamps: true });

// Indexes
coinTransactionSchema.index({ toUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ fromUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ type: 1 });
coinTransactionSchema.index({ status: 1 });

const CoinTransaction = mongoose.model('CoinTransaction', coinTransactionSchema);
module.exports = CoinTransaction;