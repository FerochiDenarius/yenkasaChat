const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const regionalRewardDailySchema = new Schema({
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true
  },
  country: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  platform: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  impressions: { type: Number, default: 0, min: 0 },
  requests: { type: Number, default: 0, min: 0 },
  adRevenue: { type: Number, default: 0, min: 0 },
  rewardPayout: { type: Number, default: 0, min: 0 },
  rewardCount: { type: Number, default: 0, min: 0 },
  accountCreations: { type: Number, default: 0, min: 0 },
  suspiciousSignals: { type: Number, default: 0, min: 0 },
  estimatedCpm: { type: Number, default: 0, min: 0 },
  verifiedCountry: { type: String, default: '' },
  detectedCountry: { type: String, default: '' },
  countryConfidence: { type: Number, default: 0, min: 0 },
  lastEventAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, collection: 'regional_reward_daily' });

regionalRewardDailySchema.index({ date: 1, country: 1, platform: 1 }, { unique: true });

module.exports =
  mongoose.models.RegionalRewardDaily ||
  mongoose.model('RegionalRewardDaily', regionalRewardDailySchema);
