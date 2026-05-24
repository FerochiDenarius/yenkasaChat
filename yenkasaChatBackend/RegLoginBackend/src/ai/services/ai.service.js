const AIUsageLog = require('../models/aiUsageLog.model');
const memoryService = require('../memory/ai-memory.service');
const knowledgeService = require('./knowledge.service');
const { getProvider } = require('../providers');
const { buildSystemPrompt } = require('../prompts/systemPrompt');
const { resolveMode, listModes } = require('../utils/mode-config');
const { estimateUsage } = require('../utils/token-usage');
const {
  buildAiMemoryContext,
  recordAiChatTurn,
} = require('../../yme/services/chatMemoryBridge.service');

function mergeSuggestions(modeConfig, providerSuggestions = []) {
  const merged = [...providerSuggestions, ...(modeConfig.suggestions || [])];
  return [...new Set(merged.filter(Boolean))].slice(0, 6);
}

function normalizeUserId(user) {
  return user?._id || user?.id;
}

async function safeLogUsage(payload) {
  try {
    await AIUsageLog.create(payload);
  } catch (error) {
    console.warn('[AIPlatform] Failed to write usage log:', error.message);
  }
}

async function safeBuildAiMemoryContext(payload) {
  try {
    return await buildAiMemoryContext(payload);
  } catch (error) {
    console.warn('[AIPlatform] Failed to load YME memory context:', error.message);
    return {
      profile: null,
      chatSummaries: [],
      matches: [],
      contextSummary: '',
    };
  }
}

async function safeRecordAiChatTurn(payload) {
  try {
    await recordAiChatTurn(payload);
  } catch (error) {
    console.warn('[AIPlatform] Failed to persist YME chat memory:', error.message);
  }
}

async function chat({ message, conversationId, user, mode = 'hybrid', includeDebug = false }) {
  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) {
    const error = new Error('Message is required.');
    error.status = 400;
    throw error;
  }

  const modeConfig = resolveMode(mode);
  const provider = getProvider(modeConfig.provider);
  const userId = normalizeUserId(user);

  const conversation = await memoryService.ensureConversation({
    conversationId,
    userId,
    mode: modeConfig.mode,
    message: trimmedMessage,
    provider: provider.name
  });

  const priorMessages = await memoryService.getConversationMessages(conversation.conversationId, userId, 12);
  const providerHistory = memoryService.buildProviderHistory(priorMessages, 10);
  const knowledgeRetrievalContext = await knowledgeService.buildRetrievalContext({
    message: trimmedMessage,
    mode: modeConfig.mode,
    provider
  });
  const aiMemoryContext = await safeBuildAiMemoryContext({
    userId,
    conversationId: conversation.conversationId,
    query: trimmedMessage,
    recentMessages: priorMessages,
  });
  const combinedRetrievalContext = [
    knowledgeRetrievalContext.contextSummary,
    aiMemoryContext.contextSummary,
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = buildSystemPrompt({
    mode: modeConfig.mode,
    user,
    conversation,
    memorySummary: conversation.summary,
    retrievalContext: combinedRetrievalContext
  });

  const providerQuestion = `${systemPrompt}\n\nUser message:\n${trimmedMessage}`;
  const startedAt = Date.now();

  try {
    const providerResponse = await provider.chat({
      question: providerQuestion,
      history: providerHistory,
      audience: modeConfig.audience,
      includeDebug
    });

    const latencyMs = Date.now() - startedAt;
    const answer = String(providerResponse?.answer || '').trim();
    const sources = providerResponse?.sources || knowledgeRetrievalContext.sources || [];
    const suggestions = mergeSuggestions(modeConfig, providerResponse?.suggested_follow_ups || []);
    const usage = estimateUsage({
      prompt: providerQuestion,
      answer,
      sources
    });

    await memoryService.appendMessage({
      conversationId: conversation.conversationId,
      userId,
      role: 'user',
      content: trimmedMessage,
      mode: modeConfig.mode,
      provider: provider.name,
      metadata: {
        requestedMode: mode
      }
    });

    await memoryService.appendMessage({
      conversationId: conversation.conversationId,
      userId,
      role: 'assistant',
      content: answer,
      mode: modeConfig.mode,
      provider: provider.name,
      sources,
      suggestions,
      usage,
      metadata: {
        model: providerResponse?.model || '',
        timings: providerResponse?.timings || {},
        debug: includeDebug ? providerResponse?.debug || null : null
      }
    });

    const freshMessages = await memoryService.getConversationMessages(conversation.conversationId, userId, 12);
    const memorySummary = await memoryService.refreshConversationState({
      conversation,
      messages: freshMessages,
      mode: modeConfig.mode,
      provider: provider.name
    });

    await safeLogUsage({
      userId,
      conversationId: conversation.conversationId,
      mode: modeConfig.mode,
      provider: provider.name,
      endpoint: '/api/ai/chat',
      success: true,
      model: providerResponse?.model || '',
      latencyMs,
      ...usage,
      metadata: {
        engineAudience: modeConfig.audience,
        retrievalAudiences: knowledgeRetrievalContext.audiences,
        engineTimings: providerResponse?.timings || {},
        ymeMatchCount: aiMemoryContext.matches?.length || 0
      }
    });

    await safeRecordAiChatTurn({
      userId,
      conversationId: conversation.conversationId,
      userMessage: trimmedMessage,
      assistantMessage: answer,
      mode: modeConfig.mode,
      sources,
    });

    return {
      success: true,
      answer,
      sources,
      suggestions,
      conversationId: conversation.conversationId,
      mode: modeConfig.mode,
      provider: provider.name,
      usage,
      memorySummary,
      debug: includeDebug
        ? {
            retrievalAudiences: knowledgeRetrievalContext.audiences,
            retrievalHints: knowledgeRetrievalContext.contextSummary,
            memoryContext: aiMemoryContext.contextSummary,
            engineDebug: providerResponse?.debug || null
          }
        : undefined
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await safeLogUsage({
      userId,
      conversationId: conversation.conversationId,
      mode: modeConfig.mode,
      provider: provider.name,
      endpoint: '/api/ai/chat',
      success: false,
      latencyMs,
      metadata: {
        error: error.message
      }
    });
    throw error;
  }
}

async function getConversationHistory({ conversationId, user }) {
  const userId = normalizeUserId(user);
  return memoryService.getConversationHistory({ conversationId, userId });
}

async function getSuggestions({ conversationId, user, mode = 'hybrid' }) {
  const modeConfig = resolveMode(mode);
  const userId = normalizeUserId(user);

  let suggestions = [...modeConfig.suggestions];

  if (conversationId) {
    const history = await memoryService.getConversationHistory({ conversationId, userId });
    const lastAssistant = [...history.messages].reverse().find((message) => message.role === 'assistant');
    if (lastAssistant?.suggestions?.length) {
      suggestions = mergeSuggestions(modeConfig, lastAssistant.suggestions);
    }
  }

  return {
    success: true,
    mode: modeConfig.mode,
    suggestions: [...new Set(suggestions)].slice(0, 6)
  };
}

function getModes() {
  return {
    success: true,
    modes: listModes()
  };
}

module.exports = {
  chat,
  getConversationHistory,
  getSuggestions,
  getModes
};
