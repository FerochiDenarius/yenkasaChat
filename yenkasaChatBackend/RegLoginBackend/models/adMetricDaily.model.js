const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const adMetricDailySchema = new Schema({
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
  impressions: { type: Number, default: 0, min: 0 },
  requests: { type: Number, default: 0, min: 0 },
  revenue: { type: Number, default: 0, min: 0 },
  ecpm: { type: Number, default: 0, min: 0 },
  fillRate: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: 'ad_metrics_daily' });

adMetricDailySchema.index({ date: 1, platform: 1 }, { unique: true });

module.exports =
  mongoose.models.AdMetricDaily ||
  mongoose.model('AdMetricDaily', adMetricDailySchema);
