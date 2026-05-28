const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { ingestEventBatch } = require('./eventIngestion.service');
const { retrieveUserMemoryContext } = require('./retrieval.service');

async function recordAiChatTurn({
  userId,
  conversationId,
  userMessage,
  assistantMessage,
  mode = 'hybrid',
  sources = [],
} = {}) {
  if (!getYmeConfig().features.aiChatBridge) {
    return {
      enabled: false,
      reason: 'bridge_disabled',
    };
  }

  const events = [
    {
      userId,
      sourceApp: 'yenkasa_ai',
      eventType: 'chat_message',
      conversationId,
      message: userMessage,
      payload: {
        mode,
      },
    },
    {
      userId,
      sourceApp: 'yenkasa_ai',
      eventType: 'chat_response',
      conversationId,
      message: assistantMessage,
      payload: {
        mode,
        sourceCount: Array.isArray(sources) ? sources.length : 0,
      },
    },
  ].filter((item) => normalizeText(item?.message || ''));

  if (!events.length) {
    return {
      enabled: true,
      count: 0,
    };
  }

  return ingestEventBatch(events);
}

async function buildAiMemoryContext({
  userId,
  conversationId = '',
  query,
  recentMessages = [],
} = {}) {
  if (!getYmeConfig().features.aiChatBridge) {
    return {
      profile: null,
      chatSummaries: [],
      matches: [],
      contextSummary: '',
    };
  }

  return retrieveUserMemoryContext({
    userId,
    query,
    conversationId,
    recentMessages,
  });
}

module.exports = {
  recordAiChatTurn,
  buildAiMemoryContext,
};
