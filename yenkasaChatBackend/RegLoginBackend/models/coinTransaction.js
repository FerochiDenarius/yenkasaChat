// models/coinTransaction.js
const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // 💰 Transaction type
  type: { 
    type: String, 
    enum: ['earn', 'spend', 'transfer', 'admin'], 
    default: 'earn' 
  },

  // 💸 Amount: positive for earning, negative for spending
  amount: { 
    type: Number, 
    required: true 
  },

  // 🧾 Human-readable reason
  description: { 
    type: String, 
    required: true, 
    trim: true 
  },

  // 🔗 Reference to related entity (optional)
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'referenceModel' 
  },
  referenceModel: { 
    type: String, 
    enum: ['Post', 'Community', 'Reward', 'User', 'Admin'], 
    default: 'Post' 
  },

  // 🧮 Balance snapshot after transaction
  balanceAfter: { 
    type: Number, 
    default: 0 
  },

  // 🪙 Internal unique reference code (e.g. for receipts or blockchain TX)
  referenceCode: { 
    type: String, 
    unique: true, 
    default: () => `TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}` 
  },

  // 🌐 Future blockchain tracking field (optional)
  txHash: { 
    type: String, 
    default: null 
  }

}, { timestamps: true });

// 📊 Optimize queries by user + time
coinTransactionSchema.index({ user: 1, createdAt: -1 });

// 🚀 Optional: auto-generate referenceCode if missing
coinTransactionSchema.pre('save', function(next) {
  if (!this.referenceCode) {
    this.referenceCode = `TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
