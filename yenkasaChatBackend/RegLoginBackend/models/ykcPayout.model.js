const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ykcPayoutSchema = new Schema({
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, default: '' },
  walletId: { type: String, default: '' },
  ykcEarnedThisMonth: { type: Number, default: 0, min: 0 },
  ykcValue: { type: Number, default: 0, min: 0 },
  payoutAmount: { type: Number, default: 0, min: 0 },
  rewardPool: { type: Number, default: 0, min: 0 },
  totalEligibleYkc: { type: Number, default: 0, min: 0 },
  totalRevenue: { type: Number, default: 0, min: 0 },
  totalImpressions: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['calculated', 'approved', 'paid', 'cancelled'],
    default: 'calculated',
    index: true
  },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'ykc_payouts' });

ykcPayoutSchema.index({ month: 1, userId: 1 }, { unique: true });

module.exports =
  mongoose.models.YkcPayout ||
  mongoose.model('YkcPayout', ykcPayoutSchema);
