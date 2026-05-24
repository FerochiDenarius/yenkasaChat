const mongoose = require('mongoose');

const histogramSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false },
);

const engagementPatternSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    hourlyHistogram: { type: [histogramSchema], default: [] },
    weekdayHistogram: { type: [histogramSchema], default: [] },
    eventTotals: { type: mongoose.Schema.Types.Mixed, default: {} },
    watchBehavior: {
      averageWatchTimeMs: { type: Number, default: 0 },
      averageScrollDurationMs: { type: Number, default: 0 },
      rewatchProbability: { type: Number, default: 0 },
    },
    engagementVelocity: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'engagement_patterns' },
);

module.exports =
  mongoose.models.EngagementPattern ||
  mongoose.model('EngagementPattern', engagementPatternSchema);
