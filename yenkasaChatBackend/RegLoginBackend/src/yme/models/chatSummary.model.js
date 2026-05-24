const mongoose = require('mongoose');

const chatSummarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    sourceApp: { type: String, default: 'yenkasa_ai', index: true },
    summaryType: { type: String, default: 'rolling_window', index: true },
    messageCount: { type: Number, default: 0 },
    windowStart: { type: Date, default: null },
    windowEnd: { type: Date, default: null },
    topics: { type: [String], default: [] },
    entities: { type: [String], default: [] },
    sentiment: { type: String, default: 'neutral' },
    summary: { type: String, required: true },
    embeddingStatus: { type: String, default: 'pending', index: true },
    lastEmbeddedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'chat_summaries' },
);

chatSummarySchema.index({ userId: 1, conversationId: 1, summaryType: 1 });

module.exports =
  mongoose.models.ChatSummary || mongoose.model('ChatSummary', chatSummarySchema);
