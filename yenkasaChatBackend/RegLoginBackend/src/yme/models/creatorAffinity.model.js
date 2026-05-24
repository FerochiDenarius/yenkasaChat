const mongoose = require('mongoose');

const creatorAffinitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceApp: { type: String, default: 'social_app', index: true },
    affinityScore: { type: Number, default: 0, index: true },
    eventCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
    watchTimeMs: { type: Number, default: 0 },
    profileVisitCount: { type: Number, default: 0 },
    contentCategories: { type: [String], default: [] },
    lastEngagedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'creator_affinity' },
);

creatorAffinitySchema.index({ userId: 1, creatorId: 1 }, { unique: true });

module.exports =
  mongoose.models.CreatorAffinity ||
  mongoose.model('CreatorAffinity', creatorAffinitySchema);
