const mongoose = require('mongoose');

const aiMemorySchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, default: 'hybrid' },
    summary: { type: String, default: '' },
    keyFacts: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'ai_memory' }
);

module.exports =
  mongoose.models.AIMemory || mongoose.model('AIMemory', aiMemorySchema);
