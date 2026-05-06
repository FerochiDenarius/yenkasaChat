const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const monthlyEconomyStatSchema = new Schema({
  month: { type: String, required: true, unique: true, index: true },
  totalRevenue: { type: Number, default: 0, min: 0 },
  rewardPool: { type: Number, default: 0, min: 0 },
  totalEligibleYkc: { type: Number, default: 0, min: 0 },
  ykcValue: { type: Number, default: 0, min: 0 },
  totalQualifiedViews: { type: Number, default: 0, min: 0 },
  totalWatchTime: { type: Number, default: 0, min: 0 },
  totalMonetizableOpportunities: { type: Number, default: 0, min: 0 },
  totalImpressions: { type: Number, default: 0, min: 0 },
  totalRequests: { type: Number, default: 0, min: 0 },
  ecpm: { type: Number, default: 0, min: 0 },
  fillRate: { type: Number, default: 0, min: 0 },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'monthly_economy_stats' });

module.exports =
  mongoose.models.MonthlyEconomyStat ||
  mongoose.model('MonthlyEconomyStat', monthlyEconomyStatSchema);
