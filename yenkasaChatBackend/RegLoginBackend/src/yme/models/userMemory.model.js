const mongoose = require('mongoose');

const scoredLabelSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    score: { type: Number, default: 0 },
    sourceCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const creatorAffinitySummarySchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, default: 0 },
    lastEngagedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const activeHourSchema = new mongoose.Schema(
  {
    hour: { type: Number, required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false },
);

const memorySummarySchema = new mongoose.Schema(
  {
    tier: { type: String, required: true },
    source: { type: String, default: 'system' },
    summary: { type: String, required: true },
    importance: { type: Number, default: 0.5 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recentContextSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    text: { type: String, default: '' },
    sourceApp: { type: String, default: '' },
    conversationId: { type: String, default: '' },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userMemorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    profileVersion: { type: Number, default: 1 },
    status: { type: String, default: 'active' },
    shortTerm: {
      activeSessionIds: { type: [String], default: [] },
      recentContext: { type: [recentContextSchema], default: [] },
      activeTopics: { type: [String], default: [] },
      activeInteractions: { type: [String], default: [] },
      lastInteractionAt: { type: Date, default: null },
    },
    midTerm: {
      recentTopics: { type: [scoredLabelSchema], default: [] },
      conversationSummaries: { type: [memorySummarySchema], default: [] },
      engagementTrends: { type: [scoredLabelSchema], default: [] },
      recentCreators: { type: [creatorAffinitySummarySchema], default: [] },
      lastConsolidatedAt: { type: Date, default: null },
    },
    longTerm: {
      stableInterests: { type: [scoredLabelSchema], default: [] },
      activeHours: { type: [activeHourSchema], default: [] },
      engagementPatterns: { type: mongoose.Schema.Types.Mixed, default: {} },
      socialGraph: { type: mongoose.Schema.Types.Mixed, default: {} },
      creatorAffinity: { type: [creatorAffinitySummarySchema], default: [] },
      commerceSignals: { type: [scoredLabelSchema], default: [] },
      emotionalPatterns: { type: [scoredLabelSchema], default: [] },
      aiProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    memorySummaries: { type: [memorySummarySchema], default: [] },
    embeddingRefs: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    lastEventAt: { type: Date, default: null },
    lastProcessedEventId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'user_memory' },
);

module.exports =
  mongoose.models.UserMemory || mongoose.model('UserMemory', userMemorySchema);
