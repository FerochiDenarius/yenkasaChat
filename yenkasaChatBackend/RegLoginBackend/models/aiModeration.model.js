const mongoose = require('mongoose');

const queueStateSchema = new mongoose.Schema(
  {
    queueName: { type: String, default: '' },
    jobId: { type: String, default: '' },
    state: {
      type: String,
      enum: ['idle', 'queued', 'processing', 'completed', 'failed', 'skipped'],
      default: 'idle',
    },
    enqueuedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    attemptsMade: { type: Number, default: 0 },
    waitMs: { type: Number, default: 0 },
    processingMs: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
  },
  { _id: false },
);

const aiModerationSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    lifecycleStatus: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed', 'reviewed'],
      default: 'queued',
      index: true,
    },
    finalAction: {
      type: String,
      enum: ['approve', 'review', 'reject', 'pending_scan'],
      default: 'pending_scan',
      index: true,
    },
    moderationSources: {
      type: [String],
      default: [],
    },
    flaggedCategories: {
      type: [String],
      default: [],
      index: true,
    },
    sourceResults: {
      text: { type: Object, default: null },
      image: { type: Object, default: null },
      video: { type: Object, default: null },
      aggregate: { type: Object, default: null },
    },
    evidence: {
      type: Object,
      default: {},
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    moderatorDecision: {
      type: String,
      enum: ['approve', 'review', 'reject', null],
      default: null,
    },
    moderatorReason: {
      type: String,
      default: '',
    },
    queue: {
      image: {
        type: queueStateSchema,
        default: () => ({}),
      },
      video: {
        type: queueStateSchema,
        default: () => ({}),
      },
    },
    metrics: {
      totalDurationMs: { type: Number, default: 0 },
      textDurationMs: { type: Number, default: 0 },
      imageDurationMs: { type: Number, default: 0 },
      videoDurationMs: { type: Number, default: 0 },
      queueWaitMs: { type: Number, default: 0 },
      queueProcessingMs: { type: Number, default: 0 },
      flaggedCount: { type: Number, default: 0 },
      accuracyOutcome: {
        type: String,
        enum: [
          'pending_human_feedback',
          'ai_confirmed',
          'human_overrode_ai',
          'not_applicable',
        ],
        default: 'pending_human_feedback',
      },
      createdAtMs: { type: Number, default: 0 },
      completedAtMs: { type: Number, default: 0 },
    },
    modelVersions: {
      text: { type: String, default: '' },
      image: { type: String, default: '' },
      video: { type: String, default: '' },
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

aiModerationSchema.index({ finalAction: 1, lifecycleStatus: 1, createdAt: -1 });
aiModerationSchema.index({ userId: 1, createdAt: -1 });
aiModerationSchema.index({ reviewedBy: 1, reviewedAt: -1 });

module.exports = mongoose.model('AiModeration', aiModerationSchema);
