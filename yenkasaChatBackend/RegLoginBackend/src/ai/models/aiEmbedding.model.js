const mongoose = require('mongoose');

const aiEmbeddingSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    audience: { type: String, default: 'public', index: true },
    provider: { type: String, default: 'fastapi_rag' },
    vectorStore: { type: String, default: 'chroma' },
    knowledgeSourceCount: { type: Number, default: 0 },
    status: { type: String, default: 'synced' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'ai_embeddings' }
);

module.exports =
  mongoose.models.AIEmbedding || mongoose.model('AIEmbedding', aiEmbeddingSchema);
