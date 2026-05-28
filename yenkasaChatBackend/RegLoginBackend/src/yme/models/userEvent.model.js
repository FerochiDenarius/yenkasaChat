const mongoose = require('mongoose');

const userEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceApp: { type: String, required: true, default: 'social_app', index: true },
    eventType: { type: String, required: true, index: true },
    sessionId: { type: String, default: '', index: true },
    clientEventId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    contentId: { type: String, default: '', index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
    messageId: { type: String, default: '' },
    traceId: { type: String, default: '', index: true },
    normalizedText: { type: String, default: '' },
    interestCandidates: { type: [String], default: [] },
    fingerprint: { type: String, default: '', index: true },
    dedupeKey: { type: String, default: '', index: true },
    importanceScore: { type: Number, default: 0.2, index: true },
    importanceReason: { type: String, default: '' },
    shouldEmbed: { type: Boolean, default: false, index: true },
    embeddingPriority: { type: Number, default: 0 },
    summaryEligible: { type: Boolean, default: false },
    duplicateCount: { type: Number, default: 0 },
    lastDuplicateAt: { type: Date, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    eventMetadata: {
      durationMs: { type: Number, default: 0 },
      watchTimeMs: { type: Number, default: 0 },
      scrollDurationMs: { type: Number, default: 0 },
      feedDwellMs: { type: Number, default: 0 },
      engagementValue: { type: Number, default: 0 },
      scrollSpeed: { type: Number, default: 0 },
      skipSpeed: { type: Number, default: 0 },
      rewatchCount: { type: Number, default: 0 },
      impressionId: { type: String, default: '' },
      appVersion: { type: String, default: '' },
      clientPlatform: { type: String, default: '' },
      traceId: { type: String, default: '' },
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'processed', 'failed', 'dead_lettered', 'skipped'],
      default: 'pending',
      index: true,
    },
    processingAttempts: { type: Number, default: 0 },
    processingLockId: { type: String, default: '' },
    queueJobId: { type: String, default: '' },
    occurredAt: { type: Date, default: Date.now, index: true },
    lastProcessingStartedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastDeadLetteredAt: { type: Date, default: null },
    processingError: { type: String, default: '' },
    processingNotes: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'user_events' },
);

userEventSchema.index({ userId: 1, occurredAt: -1 });
userEventSchema.index({ userId: 1, eventType: 1, occurredAt: -1 });
userEventSchema.index({ userId: 1, dedupeKey: 1, occurredAt: -1 });
userEventSchema.index({ userId: 1, shouldEmbed: 1, importanceScore: -1, occurredAt: -1 });

module.exports =
  mongoose.models.UserEvent || mongoose.model('UserEvent', userEventSchema);
