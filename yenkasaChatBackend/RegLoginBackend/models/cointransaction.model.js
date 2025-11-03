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
  amount: {
    type: Number,
    required: true
  },
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
  description: {
    type: String,
    default: ''
  },
  relatedPostId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },

  activityId: {
  type: String,
  index: true,
  unique: false // ✅ not unique because many different types can share
},

transactionId: {
  type: String,
  unique: true // ✅ unique transaction reference for each reward
},

  relatedCommentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
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



// Indexes
coinTransactionSchema.index({ toUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ fromUserId: 1, createdAt: -1 });
coinTransactionSchema.index({ type: 1 });
coinTransactionSchema.index({ status: 1 });

// ✅ Export the model safely
module.exports = mongoose.models.CoinTransaction || mongoose.model("CoinTransaction", coinTransactionSchema);
