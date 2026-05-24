const mongoose = require('mongoose');

const memoryLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserEvent', default: null, index: true },
    jobName: { type: String, default: '', index: true },
    queueName: { type: String, default: '', index: true },
    stage: { type: String, required: true, index: true },
    level: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info', index: true },
    status: { type: String, default: 'success', index: true },
    message: { type: String, required: true },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'memory_logs' },
);

memoryLogSchema.index({ createdAt: -1, level: 1 });

module.exports =
  mongoose.models.MemoryLog || mongoose.model('MemoryLog', memoryLogSchema);
