const mongoose = require('mongoose');

const AIConversation = require('../models/aiConversation.model');
const AIMessage = require('../models/aiMessage.model');
const AIMemory = require('../models/aiMemory.model');

function buildConversationTitle(message) {
  const normalized = String(message || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return 'New AI conversation';
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

async function ensureConversation({ conversationId, userId, mode, message, provider }) {
  if (conversationId) {
    const existing = await AIConversation.findOne({ conversationId, userId });
    if (!existing) {
      const error = new Error('AI conversation not found.');
      error.status = 404;
      throw error;
    }
    if (mode && existing.mode !== mode) {
      existing.mode = mode;
      existing.provider = provider || existing.provider;
      await existing.save();
    }
    return existing;
  }

  const generatedConversationId = new mongoose.Types.ObjectId().toString();
  return AIConversation.create({
    conversationId: generatedConversationId,
    userId,
    mode,
    provider,
    title: buildConversationTitle(message),
    lastMessageAt: new Date()
  });
}

async function appendMessage(payload) {
  return AIMessage.create(payload);
}

async function getConversationMessages(conversationId, userId, limit = 20) {
  return AIMessage.find({ conversationId, userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

function buildProviderHistory(messages, limit = 10) {
  return [...messages]
    .reverse()
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function summarizeMessages(messages) {
  const recent = [...messages]
    .reverse()
    .slice(-6)
    .map((message) => `${message.role}: ${String(message.content || '').replace(/\s+/g, ' ').trim()}`)
    .join('\n');

  return recent.length > 900 ? `${recent.slice(0, 897)}...` : recent;
}

async function refreshConversationState({ conversation, messages, mode, provider }) {
  const summary = summarizeMessages(messages);

  conversation.mode = mode || conversation.mode;
  conversation.provider = provider || conversation.provider;
  conversation.summary = summary;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  await AIMemory.findOneAndUpdate(
    {
      conversationId: conversation.conversationId,
      userId: conversation.userId
    },
    {
      $set: {
        mode: conversation.mode,
        summary,
        lastMessageAt: conversation.lastMessageAt,
        keyFacts: [],
        tags: [conversation.mode, 'yenkasa_ai'],
        metadata: {
          provider: conversation.provider
        }
      }
    },
    { upsert: true, new: true }
  );

  return summary;
}

async function getConversationHistory({ conversationId, userId }) {
  const conversation = await AIConversation.findOne({ conversationId, userId }).lean();
  if (!conversation) {
    const error = new Error('AI conversation not found.');
    error.status = 404;
    throw error;
  }

  const messages = await AIMessage.find({ conversationId, userId }).sort({ createdAt: 1 }).lean();
  return { conversation, messages };
}

module.exports = {
  ensureConversation,
  appendMessage,
  getConversationMessages,
  buildProviderHistory,
  refreshConversationState,
  getConversationHistory
};
