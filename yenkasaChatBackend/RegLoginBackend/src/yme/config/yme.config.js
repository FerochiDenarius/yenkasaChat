function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseNumber(value, defaultValue) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : defaultValue;
}

const DEFAULT_EVENT_TYPES = Object.freeze([
  'like',
  'comment',
  'share',
  'follow',
  'unfollow',
  'watch',
  'post_view',
  'video_watch',
  'watch_duration',
  'scroll',
  'profile_visit',
  'search',
  'chat_message',
  'ai_chat_message',
  'chat_response',
  'caption',
  'save_post',
  'creator_interaction',
  'live_stream_join',
  'stream_started',
  'stream_ended',
  'stream_joined',
  'stream_left',
  'stream_comment',
  'stream_like',
  'stream_gift',
  'stream_share',
  'stream_report',
  'stream_follow_host',
  'stream_pin_comment',
  'stream_moderation_action',
  'stream_ban_user',
  'stream_warning',
  'stream_view_duration',
  'stream_peak_viewers',
  'reward_claim',
  'community_join',
  'community_post_created',
  'ad_interaction',
  'ad_engagement',
  'notification_sent',
  'notification_open',
  'notification_opened',
  'notification_dismissed',
  'live_interaction',
]);

const DEFAULT_SOURCE_APPS = Object.freeze([
  'social_app',
  'yenkasa_ai',
  'system',
  'livestream',
  'live_arena',
]);

function getYmeConfig() {
  const projectId =
    process.env.YENKASA_GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    '';
  const location = process.env.YENKASA_VERTEX_LOCATION || 'us-central1';
  const modelId = process.env.YENKASA_GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
  const outputDimensionality = parseNumber(
    process.env.YENKASA_YME_EMBEDDING_DIMENSIONS,
    768,
  );

  return {
    sourceApps: DEFAULT_SOURCE_APPS,
    eventTypes: DEFAULT_EVENT_TYPES,
    api: {
      batchLimit: parseNumber(process.env.YENKASA_YME_BATCH_LIMIT, 100),
      retrievalLimit: parseNumber(process.env.YENKASA_YME_RETRIEVAL_LIMIT, 8),
      maxPayloadBytes: parseNumber(process.env.YENKASA_YME_MAX_PAYLOAD_BYTES, 32768),
      eventTextLimit: parseNumber(process.env.YENKASA_YME_EVENT_TEXT_LIMIT, 4000),
      eventRateLimitPerMinute: parseNumber(
        process.env.YENKASA_YME_EVENT_RATE_LIMIT_PER_MINUTE,
        120,
      ),
      batchRateLimitPerMinute: parseNumber(
        process.env.YENKASA_YME_BATCH_RATE_LIMIT_PER_MINUTE,
        24,
      ),
      retrievalRateLimitPerMinute: parseNumber(
        process.env.YENKASA_YME_RETRIEVAL_RATE_LIMIT_PER_MINUTE,
        30,
      ),
    },
    queue: {
      mode: String(process.env.YENKASA_YME_QUEUE_MODE || 'bullmq').trim().toLowerCase(),
      enabled: process.env.YENKASA_YME_QUEUE_ENABLED !== 'false',
      prefix: String(process.env.YENKASA_YME_QUEUE_PREFIX || 'yme').trim(),
      eventAttempts: parseNumber(process.env.YENKASA_YME_EVENT_ATTEMPTS, 3),
      embeddingAttempts: parseNumber(process.env.YENKASA_YME_EMBEDDING_ATTEMPTS, 2),
      consolidationAttempts: parseNumber(process.env.YENKASA_YME_CONSOLIDATION_ATTEMPTS, 2),
      eventBackoffMs: parseNumber(process.env.YENKASA_YME_EVENT_BACKOFF_MS, 5000),
      embeddingBackoffMs: parseNumber(process.env.YENKASA_YME_EMBEDDING_BACKOFF_MS, 15000),
      consolidationBackoffMs: parseNumber(process.env.YENKASA_YME_CONSOLIDATION_BACKOFF_MS, 30000),
      eventConcurrency: parseNumber(process.env.YENKASA_YME_EVENT_CONCURRENCY, 4),
      embeddingConcurrency: parseNumber(process.env.YENKASA_YME_EMBEDDING_CONCURRENCY, 2),
      consolidationConcurrency: parseNumber(process.env.YENKASA_YME_CONSOLIDATION_CONCURRENCY, 1),
      chatSummaryConcurrency: parseNumber(process.env.YENKASA_YME_CHAT_SUMMARY_CONCURRENCY, 2),
      embeddingRateWindowMs: parseNumber(
        process.env.YENKASA_YME_EMBEDDING_RATE_WINDOW_MS,
        60000,
      ),
      embeddingRateMax: parseNumber(process.env.YENKASA_YME_EMBEDDING_RATE_MAX, 30),
    },
    embedding: {
      enabled: parseBoolean(process.env.YENKASA_YME_EMBEDDINGS_ENABLED, true),
      projectId,
      location,
      modelId,
      outputDimensionality,
      autoTruncate: parseBoolean(process.env.YENKASA_YME_AUTO_TRUNCATE, true),
      batchSize: parseNumber(process.env.YENKASA_YME_EMBEDDING_BATCH_SIZE, 5),
      minRequestIntervalMs: parseNumber(
        process.env.YENKASA_YME_EMBEDDING_MIN_REQUEST_INTERVAL_MS,
        250,
      ),
      directEventImportanceThreshold: parseNumber(
        process.env.YENKASA_YME_DIRECT_EVENT_EMBED_THRESHOLD,
        0.62,
      ),
      minTextLength: parseNumber(process.env.YENKASA_YME_EMBEDDING_MIN_TEXT_LENGTH, 24),
    },
    vector: {
      enabled: parseBoolean(process.env.YENKASA_YME_VECTOR_SEARCH_ENABLED, true),
      indexName: String(
        process.env.YENKASA_YME_VECTOR_INDEX_NAME || 'yme_memory_embeddings_vector_index',
      ).trim(),
      similarity: String(process.env.YENKASA_YME_VECTOR_SIMILARITY || 'cosine').trim(),
      quantization: String(process.env.YENKASA_YME_VECTOR_QUANTIZATION || 'none').trim(),
      numCandidatesMultiplier: parseNumber(
        process.env.YENKASA_YME_VECTOR_NUM_CANDIDATES_MULTIPLIER,
        20,
      ),
    },
    consolidation: {
      enabled: process.env.YENKASA_YME_CONSOLIDATION_ENABLED !== 'false',
      triggerEveryEvents: parseNumber(process.env.YENKASA_YME_CONSOLIDATE_EVERY_EVENTS, 12),
      recentChatWindow: parseNumber(process.env.YENKASA_YME_RECENT_CHAT_WINDOW, 8),
      recentEventWindow: parseNumber(process.env.YENKASA_YME_RECENT_EVENT_WINDOW, 50),
      recentContextLimit: parseNumber(process.env.YENKASA_YME_RECENT_CONTEXT_LIMIT, 20),
      stableInterestLimit: parseNumber(process.env.YENKASA_YME_STABLE_INTEREST_LIMIT, 24),
      recentTopicLimit: parseNumber(process.env.YENKASA_YME_RECENT_TOPIC_LIMIT, 12),
      creatorAffinityLimit: parseNumber(process.env.YENKASA_YME_CREATOR_AFFINITY_LIMIT, 20),
      socialTieLimit: parseNumber(process.env.YENKASA_YME_SOCIAL_TIE_LIMIT, 20),
      staleInterestHalfLifeDays: parseNumber(
        process.env.YENKASA_YME_STALE_INTEREST_HALF_LIFE_DAYS,
        30,
      ),
    },
    guard: {
      duplicateWindowMs: parseNumber(process.env.YENKASA_YME_DUPLICATE_WINDOW_MS, 30000),
      lowSignalDuplicateWindowMs: parseNumber(
        process.env.YENKASA_YME_LOW_SIGNAL_DUPLICATE_WINDOW_MS,
        15000,
      ),
      lowValueThrottleWindowMs: parseNumber(
        process.env.YENKASA_YME_LOW_VALUE_THROTTLE_WINDOW_MS,
        60000,
      ),
      lowValueThrottleMax: parseNumber(
        process.env.YENKASA_YME_LOW_VALUE_THROTTLE_MAX,
        40,
      ),
    },
    importance: {
      mediumThreshold: parseNumber(process.env.YENKASA_YME_IMPORTANCE_MEDIUM_THRESHOLD, 0.45),
      highThreshold: parseNumber(process.env.YENKASA_YME_IMPORTANCE_HIGH_THRESHOLD, 0.75),
      lowSignalMaxChars: parseNumber(process.env.YENKASA_YME_LOW_SIGNAL_MAX_CHARS, 24),
    },
    features: {
      inlineWorkers: process.env.YENKASA_ENABLE_INLINE_YME_WORKERS !== 'false',
      aiChatBridge: process.env.YENKASA_YME_ENABLE_AI_CHAT_BRIDGE !== 'false',
      structuredLogs: process.env.YENKASA_YME_STRUCTURED_LOGS !== 'false',
    },
  };
}

module.exports = {
  DEFAULT_EVENT_TYPES,
  DEFAULT_SOURCE_APPS,
  getYmeConfig,
};
