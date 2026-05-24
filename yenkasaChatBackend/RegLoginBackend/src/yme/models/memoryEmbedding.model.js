const mongoose = require('mongoose');

const memoryEmbeddingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceType: { type: String, required: true, index: true },
    sourceId: { type: String, required: true, index: true },
    sourceApp: { type: String, default: 'system', index: true },
    memoryTier: {
      type: String,
      enum: ['short_term', 'mid_term', 'long_term'],
      required: true,
      index: true,
    },
    taskType: { type: String, default: 'RETRIEVAL_DOCUMENT' },
    model: { type: String, default: '' },
    title: { type: String, default: '' },
    text: { type: String, required: true },
    contentHash: { type: String, default: '', index: true },
    embedding: { type: [Number], default: undefined },
    dimensions: { type: Number, default: 0 },
    importance: { type: Number, default: 0.5 },
    cacheHitCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ready', 'skipped', 'failed'],
      default: 'ready',
      index: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'memory_embeddings' },
);

memoryEmbeddingSchema.index(
  { userId: 1, sourceType: 1, sourceId: 1, memoryTier: 1 },
  { unique: true },
);
memoryEmbeddingSchema.index({ contentHash: 1, taskType: 1, model: 1, status: 1 });

module.exports =
  mongoose.models.MemoryEmbedding ||
  mongoose.model('MemoryEmbedding', memoryEmbeddingSchema);
