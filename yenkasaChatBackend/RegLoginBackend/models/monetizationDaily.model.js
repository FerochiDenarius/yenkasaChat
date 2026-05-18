const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const monetizationDailySchema = new Schema({
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['android', 'web'],
    index: true
  },
  country: {
    type: String,
    required: true,
    index: true
  },
  totalAdImpressions: { type: Number, default: 0, min: 0 },
  rewardedAdsCompleted: { type: Number, default: 0, min: 0 },
  midRollAdsShown: { type: Number, default: 0, min: 0 },
  interstitialAdsShown: { type: Number, default: 0, min: 0 },
  adWatchDuration: { type: Number, default: 0, min: 0 },
  skippedAds: { type: Number, default: 0, min: 0 },
  monetizedPlaybackSessions: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: 'monetization_daily' });

monetizationDailySchema.index({ date: 1, platform: 1, country: 1 }, { unique: true });

module.exports =
  mongoose.models.MonetizationDaily ||
  mongoose.model('MonetizationDaily', monetizationDailySchema);
