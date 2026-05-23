const mongoose = require('mongoose');

const aiConversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, default: 'hybrid', index: true },
    title: { type: String, default: 'New AI conversation' },
    summary: { type: String, default: '' },
    provider: { type: String, default: 'fastapi_rag' },
    lastMessageAt: { type: Date, default: Date.now },
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'ai_conversations' }
);

module.exports =
  mongoose.models.AIConversation || mongoose.model('AIConversation', aiConversationSchema);
