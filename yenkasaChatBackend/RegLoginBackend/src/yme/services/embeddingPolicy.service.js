const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { clamp } = require('../utils/yme.utils');

const DIRECT_EMBEDDABLE_TYPES = new Set([
  'caption',
  'chat_message',
  'ai_chat_message',
  'chat_response',
  'creator_interaction',
  'community_join',
]);

const SUMMARY_ELIGIBLE_TYPES = new Set([
  'follow',
  'unfollow',
  'share',
  'search',
  'watch',
  'video_watch',
  'watch_duration',
  'save_post',
  'creator_interaction',
  'community_join',
  'chat_message',
  'ai_chat_message',
  'chat_response',
  'caption',
]);

const LOW_SIGNAL_MESSAGES = new Set(['hi', 'hello', 'hey', 'ok', 'thanks', 'yes', 'no']);

function isMeaningfulText(text = '', minLength = 24) {
  const normalized = normalizeText(text || '');
  if (!normalized) return false;
  if (normalized.length < minLength) return false;
  if (LOW_SIGNAL_MESSAGES.has(normalized)) return false;
  return true;
}

function buildEmbeddingPolicy(event = {}, scoring = {}) {
  const config = getYmeConfig();
  const text = normalizeText(event?.normalizedText || '');
  const importanceScore = Number(scoring.importanceScore || event.importanceScore || 0);
  const shouldConsiderDirectEmbedding = DIRECT_EMBEDDABLE_TYPES.has(event.eventType);
  const summaryEligible = SUMMARY_ELIGIBLE_TYPES.has(event.eventType);
  let shouldEmbed = false;
  let reason = 'not_embeddable';
  let memoryTier = 'mid_term';

  if (shouldConsiderDirectEmbedding && isMeaningfulText(text, config.embedding.minTextLength)) {
    if (importanceScore >= config.embedding.directEventImportanceThreshold) {
      shouldEmbed = true;
      reason = 'meaningful_high_importance_event';
    } else {
      reason = 'below_importance_threshold';
    }
  } else if (shouldConsiderDirectEmbedding && text && !isMeaningfulText(text, config.embedding.minTextLength)) {
    reason = 'text_too_short';
  }

  if (event.eventType === 'chat_message' || event.eventType === 'ai_chat_message') {
    memoryTier = 'short_term';
  }
  if (event.eventType === 'chat_response') {
    memoryTier = 'mid_term';
  }
  if (event.eventType === 'caption' || event.eventType === 'community_join') {
    memoryTier = 'mid_term';
  }

  return {
    shouldEmbed,
    summaryEligible,
    memoryTier,
    embeddingPriority: clamp(importanceScore + (shouldEmbed ? 0.15 : 0), 0, 1),
    reason,
  };
}

module.exports = {
  buildEmbeddingPolicy,
};
