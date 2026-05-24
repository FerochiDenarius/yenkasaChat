const mongoose = require('mongoose');

const recommendationSignalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    category: { type: String, default: '', index: true },
    affinityScore: { type: Number, default: 0, index: true },
    engagementProbability: { type: Number, default: 0 },
    rewatchProbability: { type: Number, default: 0 },
    freshnessScore: { type: Number, default: 0.5 },
    scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastSignalAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'recommendation_signals' },
);

recommendationSignalSchema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });

module.exports =
  mongoose.models.RecommendationSignal ||
  mongoose.model('RecommendationSignal', recommendationSignalSchema);
