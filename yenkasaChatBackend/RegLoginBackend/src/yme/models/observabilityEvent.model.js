const mongoose = require('mongoose');

const EVENT_CATEGORIES = Object.freeze([
  'user_activity',
  'engagement',
  'system_error',
  'api_failure',
  'upload_failure',
  'moderation_event',
  'auth_event',
  'payment_event',
  'ai_event',
  'recommendation_event',
  'analytics_event',
  'infrastructure_event',
]);

const SEVERITY_LEVELS = Object.freeze(['debug', 'info', 'warn', 'error', 'critical']);
const STATUS_VALUES = Object.freeze([
  'accepted',
  'processing',
  'processed',
  'partial_failure',
  'failed',
  'duplicate',
]);

const sinkStatusSchema = new mongoose.Schema(
  {
    status: { type: String, default: 'pending' },
    attempts: { type: Number, default: 0 },
    queuedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    referenceId: { type: String, default: '' },
    lastError: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const observabilityEventSchema = new mongoose.Schema(
  {
    traceId: { type: String, required: true, index: true },
    parentTraceId: { type: String, default: '', index: true },
    dedupeKey: { type: String, default: '', index: true },
    category: { type: String, enum: EVENT_CATEGORIES, required: true, index: true },
    eventName: { type: String, required: true, index: true },
    eventType: { type: String, default: '', index: true },
    severity: { type: String, enum: SEVERITY_LEVELS, default: 'info', index: true },
    status: { type: String, enum: STATUS_VALUES, default: 'accepted', index: true },
    importanceScore: { type: Number, default: 0.2, index: true },
    importanceBand: { type: String, default: 'low', index: true },
    userId: { type: String, default: '', index: true },
    relatedUserId: { type: String, default: '', index: true },
    creatorId: { type: String, default: '', index: true },
    communityId: { type: String, default: '', index: true },
    contentId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    sessionId: { type: String, default: '', index: true },
    sourceApp: { type: String, default: 'social_app', index: true },
    sourceModule: { type: String, default: '', index: true },
    routePath: { type: String, default: '', index: true },
    routeGroup: { type: String, default: '', index: true },
    httpMethod: { type: String, default: '', index: true },
    statusCode: { type: Number, default: 0, index: true },
    latencyMs: { type: Number, default: 0, index: true },
    ymeEligible: { type: Boolean, default: false, index: true },
    clientPlatform: { type: String, default: '', index: true },
    appVersion: { type: String, default: '', index: true },
    retryCount: { type: Number, default: 0 },
    occurredAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    sinkStatus: {
      yme: { type: sinkStatusSchema, default: () => ({ status: 'pending' }) },
      intelligence: { type: sinkStatusSchema, default: () => ({ status: 'pending' }) },
      logs: { type: sinkStatusSchema, default: () => ({ status: 'pending' }) },
    },
  },
  { timestamps: true, collection: 'yme_observability_events' },
);

observabilityEventSchema.index({ category: 1, occurredAt: -1 });
observabilityEventSchema.index({ severity: 1, occurredAt: -1 });
observabilityEventSchema.index({ userId: 1, category: 1, occurredAt: -1 });
observabilityEventSchema.index({ routeGroup: 1, occurredAt: -1 });
observabilityEventSchema.index({ sourceModule: 1, occurredAt: -1 });
observabilityEventSchema.index({ statusCode: 1, occurredAt: -1 });
observabilityEventSchema.index({ ymeEligible: 1, occurredAt: -1 });
observabilityEventSchema.index({ creatorId: 1, occurredAt: -1 });
observabilityEventSchema.index({ communityId: 1, occurredAt: -1 });
observabilityEventSchema.index({ contentId: 1, occurredAt: -1 });

module.exports = {
  EVENT_CATEGORIES,
  SEVERITY_LEVELS,
  STATUS_VALUES,
  ObservabilityEvent:
    mongoose.models.ObservabilityEvent ||
    mongoose.model('ObservabilityEvent', observabilityEventSchema),
};
