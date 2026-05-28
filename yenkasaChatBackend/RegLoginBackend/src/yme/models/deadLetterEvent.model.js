const mongoose = require('mongoose');

const deadLetterEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEvent',
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sourceApp: { type: String, default: '', index: true },
    eventType: { type: String, default: '', index: true },
    traceId: { type: String, default: '', index: true },
    jobName: { type: String, default: '', index: true },
    queueName: { type: String, default: '', index: true },
    stage: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: ['open', 'retrying', 'resolved'],
      default: 'open',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    fingerprint: { type: String, default: '', index: true },
    dedupeKey: { type: String, default: '', index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    eventSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastError: { type: mongoose.Schema.Types.Mixed, default: null },
    firstFailedAt: { type: Date, default: Date.now },
    lastFailedAt: { type: Date, default: Date.now, index: true },
    lastResolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' },
  },
  { timestamps: true, collection: 'yme_dead_letter_events' },
);

deadLetterEventSchema.index({ status: 1, lastFailedAt: -1 });
deadLetterEventSchema.index({ eventType: 1, status: 1, lastFailedAt: -1 });

module.exports =
  mongoose.models.DeadLetterEvent ||
  mongoose.model('DeadLetterEvent', deadLetterEventSchema);
