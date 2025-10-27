// models/coinTransaction.js
const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Positive for earning, negative for spending
  amount: { type: Number, required: true },

  // Description: "Posted in Adenta", "Liked post", "Redeemed for airtime"
  description: { type: String, required: true },

  // Optional post or reference (to know what caused the transaction)
  referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'referenceModel' },
  referenceModel: { type: String, enum: ['Post', 'Community', 'Reward'], default: 'Post' },

  // Balance snapshot after this transaction
  balanceAfter: { type: Number, default: 0 },

}, { timestamps: true });

coinTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
