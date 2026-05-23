const mongoose = require('mongoose');

const aiKnowledgeChunkSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    sourceFile: { type: String, required: true, index: true },
    audience: { type: String, default: 'public', index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, default: 'fastapi_rag' },
    status: { type: String, default: 'ingested' },
    category: { type: String, default: 'uploaded_knowledge' },
    tags: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'ai_knowledge_chunks' }
);

module.exports =
  mongoose.models.AIKnowledgeChunk || mongoose.model('AIKnowledgeChunk', aiKnowledgeChunkSchema);
