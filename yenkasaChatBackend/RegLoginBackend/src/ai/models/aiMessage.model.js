const mongoose = require('mongoose');

const aiMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    mode: { type: String, default: 'hybrid' },
    provider: { type: String, default: 'fastapi_rag' },
    sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
    suggestions: { type: [String], default: [] },
    usage: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'ai_messages' }
);

module.exports =
  mongoose.models.AIMessage || mongoose.model('AIMessage', aiMessageSchema);
