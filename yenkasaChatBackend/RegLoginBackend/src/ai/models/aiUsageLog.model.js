const mongoose = require('mongoose');

const aiUsageLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: String, index: true },
    mode: { type: String, default: 'hybrid' },
    provider: { type: String, default: 'fastapi_rag' },
    endpoint: { type: String, default: '/api/ai/chat' },
    success: { type: Boolean, default: true },
    model: { type: String, default: '' },
    latencyMs: { type: Number, default: 0 },
    estimatedPromptTokens: { type: Number, default: 0 },
    estimatedCompletionTokens: { type: Number, default: 0 },
    estimatedTotalTokens: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'ai_usage_logs' }
);

module.exports =
  mongoose.models.AIUsageLog || mongoose.model('AIUsageLog', aiUsageLogSchema);
