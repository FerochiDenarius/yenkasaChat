const User = require('../../../models/user.model');
const AIProfile = require('../models/aiProfile.model');
const ChatSummary = require('../models/chatSummary.model');
const CreatorAffinity = require('../models/creatorAffinity.model');
const EngagementPattern = require('../models/engagementPattern.model');
const MemoryEmbedding = require('../models/memoryEmbedding.model');
const MemoryLog = require('../models/memoryLog.model');
const RecommendationSignal = require('../models/recommendationSignal.model');
const SocialGraph = require('../models/socialGraph.model');
const UserEvent = require('../models/userEvent.model');
const UserMemory = require('../models/userMemory.model');
const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { retrieveUserMemoryContext } = require('./retrieval.service');
const { getMetricsSnapshot } = require('./metrics.service');
const { getQueueHealth, getQueueState } = require('./queue.service');
const { clamp, toObjectId } = require('../utils/yme.utils');

const EVENT_SIGNAL_BASE = {
  like: 0.28,
  comment: 0.56,
  share: 0.72,
  follow: 0.82,
  unfollow: 0.24,
  watch: 0.4,
  post_view: 0.18,
  video_watch: 0.45,
  watch_duration: 0.94,
  scroll: 0.1,
  profile_visit: 0.22,
  search: 0.66,
  chat_message: 0.68,
  ai_chat_message: 0.72,
  chat_response: 0.48,
  caption: 0.62,
  creator_interaction: 0.6,
  live_stream_join: 0.88,
  live_interaction: 0.74,
  reward_claim: 0.78,
  community_join: 0.7,
  community_leave: 0.26,
  notification_open: 0.16,
  ad_interaction: 0.08,
  ad_engagement: 0.08,
};

function safeObjectId(value) {
  if (!value) return null;
  const objectId = toObjectId(value);
  if (!objectId) {
    const error = new Error('userId must be a valid Mongo ObjectId.');
    error.status = 400;
    throw error;
  }
  return objectId;
}

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mean(values = []) {
  const normalized = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!normalized.length) return 0;
  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

function uniqueByKey(items = [], keyFn) {
  const seen = new Set();
  const results = [];
  for (const item of items) {
    const key = String(keyFn(item) || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

function sortDescending(items = [], scoreKey = 'score') {
  return [...items].sort((left, right) => finiteNumber(right?.[scoreKey]) - finiteNumber(left?.[scoreKey]));
}

function estimateDocumentSizeBytes(document) {
  try {
    return Buffer.byteLength(JSON.stringify(document || {}), 'utf8');
  } catch (_error) {
    return 0;
  }
}

function buildEventSignalScore(event = {}) {
  const base = EVENT_SIGNAL_BASE[event.eventType] ?? 0.24;
  const importance = finiteNumber(event.importanceScore, 0.2);
  const watchTimeMs = finiteNumber(event?.eventMetadata?.watchTimeMs, 0);
  const feedDwellMs = finiteNumber(event?.eventMetadata?.feedDwellMs, 0);
  const rewatchCount = finiteNumber(event?.eventMetadata?.rewatchCount, 0);
  const engagementValue = finiteNumber(event?.eventMetadata?.engagementValue, 0);
  const duplicateCount = finiteNumber(event.duplicateCount, 0);
  const shouldEmbedBoost = event.shouldEmbed ? 0.08 : 0;
  const summaryBoost = event.summaryEligible ? 0.04 : 0;
  const textBoost = normalizeText(event?.normalizedText || '').length >= 40 ? 0.05 : 0;

  let score = base * 0.5 + importance * 0.3 + shouldEmbedBoost + summaryBoost + textBoost;

  if (watchTimeMs >= 10_000) score += 0.08;
  if (watchTimeMs >= 30_000) score += 0.06;
  if (feedDwellMs >= 8_000) score += 0.05;
  if (rewatchCount > 0) score += Math.min(0.18, rewatchCount * 0.04);
  if (engagementValue > 0) score += Math.min(0.08, engagementValue * 0.02);
  if (duplicateCount > 0) score -= Math.min(0.3, duplicateCount * 0.08);
  if (event.processingStatus === 'skipped') score -= 0.12;
  if (event.processingStatus === 'failed') score -= 0.1;

  return clamp(score, 0, 1);
}

function buildSignalCalibration(events = []) {
  const byType = new Map();
  let duplicateCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let spamCount = 0;

  for (const event of events) {
    const eventType = String(event?.eventType || '').trim();
    if (!eventType) continue;

    const bucket = byType.get(eventType) || {
      eventType,
      eventCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      failedCount: 0,
      spamCount: 0,
      shouldEmbedCount: 0,
      summaryEligibleCount: 0,
      importance: [],
      scores: [],
      signals: [],
    };

    const signalScore = buildEventSignalScore(event);
    const importance = finiteNumber(event.importanceScore, 0.2);
    const duplicates = finiteNumber(event.duplicateCount, 0);
    const lowSignalText = normalizeText(event.normalizedText || '').length <= 12;

    bucket.eventCount += 1;
    bucket.duplicateCount += duplicates;
    bucket.skippedCount += event.processingStatus === 'skipped' ? 1 : 0;
    bucket.failedCount += event.processingStatus === 'failed' ? 1 : 0;
    bucket.spamCount += duplicates > 0 && lowSignalText ? 1 : 0;
    bucket.shouldEmbedCount += event.shouldEmbed ? 1 : 0;
    bucket.summaryEligibleCount += event.summaryEligible ? 1 : 0;
    bucket.importance.push(importance);
    bucket.scores.push(signalScore);
    bucket.signals.push({
      id: String(event._id || event.id || ''),
      occurredAt: event.occurredAt,
      signalStrengthScore: signalScore,
      importanceScore: importance,
      shouldEmbed: Boolean(event.shouldEmbed),
      processingStatus: event.processingStatus || 'pending',
    });

    duplicateCount += duplicates;
    skippedCount += event.processingStatus === 'skipped' ? 1 : 0;
    failedCount += event.processingStatus === 'failed' ? 1 : 0;
    spamCount += duplicates > 0 && lowSignalText ? 1 : 0;

    byType.set(eventType, bucket);
  }

  const totalEvents = events.length;
  const eventTypes = [...byType.values()]
    .map((bucket) => {
      const duplicateRate = bucket.eventCount ? bucket.duplicateCount / bucket.eventCount : 0;
      const spamRate = bucket.eventCount ? bucket.spamCount / bucket.eventCount : 0;
      const usefulScore = clamp(
        mean(bucket.scores) * 0.8 + clamp(bucket.shouldEmbedCount / Math.max(bucket.eventCount, 1), 0, 1) * 0.2,
        0,
        1,
      );

      return {
        eventType: bucket.eventType,
        eventCount: bucket.eventCount,
        signalStrengthScore: clamp(mean(bucket.scores), 0, 1),
        eventUsefulnessScore: usefulScore,
        duplicateRate: Number(duplicateRate.toFixed(3)),
        spamRate: Number(spamRate.toFixed(3)),
        shouldEmbedRate: Number((bucket.shouldEmbedCount / Math.max(bucket.eventCount, 1)).toFixed(3)),
        summaryEligibleRate: Number((bucket.summaryEligibleCount / Math.max(bucket.eventCount, 1)).toFixed(3)),
        averageImportance: Number(mean(bucket.importance).toFixed(3)),
        signals: sortDescending(bucket.signals, 'signalStrengthScore').slice(0, 5),
      };
    })
    .sort((left, right) => right.signalStrengthScore - left.signalStrengthScore);

  const strongSignals = eventTypes.slice(0, 5);
  const weakSignals = [...eventTypes]
    .sort((left, right) => left.signalStrengthScore - right.signalStrengthScore)
    .slice(0, 5);
  const noisySignals = eventTypes
    .filter((entry) => entry.duplicateRate >= 0.25 || entry.spamRate >= 0.2 || entry.signalStrengthScore < 0.35)
    .slice(0, 5);

  return {
    totalEvents,
    duplicateEventCount: duplicateCount,
    skippedEventCount: skippedCount,
    failedEventCount: failedCount,
    spamEventCount: spamCount,
    duplicateFrequency: totalEvents ? duplicateCount / totalEvents : 0,
    skippedFrequency: totalEvents ? skippedCount / totalEvents : 0,
    failedFrequency: totalEvents ? failedCount / totalEvents : 0,
    spamFrequency: totalEvents ? spamCount / totalEvents : 0,
    strongestSignals: strongSignals,
    weakSignals,
    noisySignals,
    eventTypes,
  };
}

function buildRetrievalQuality({
  matches = [],
  embeddings = [],
  query = '',
  latencyMs = 0,
} = {}) {
  const normalizedQuery = normalizeText(query || '');
  const scoredMatches = matches.map((match) => {
    const score = finiteNumber(match.blendedScore ?? match.score, 0);
    const normalizedScore = clamp(score, 0, 1);
    return {
      ...match,
      retrievalScore: normalizedScore,
    };
  });

  const embeddingBySourceId = new Map(
    embeddings.map((embedding) => [String(embedding.sourceId || ''), embedding]),
  );

  const duplicateGroups = new Map();
  let staleCount = 0;
  let lowQualityCount = 0;

  for (const match of scoredMatches) {
    const sourceKey = `${match.sourceType || ''}:${match.sourceId || ''}`;
    duplicateGroups.set(sourceKey, (duplicateGroups.get(sourceKey) || 0) + 1);

    if (match.retrievalScore < 0.35) lowQualityCount += 1;

    const embedding = embeddingBySourceId.get(String(match.sourceId || ''));
    const ageMs = embedding ? Date.now() - new Date(embedding.updatedAt || embedding.createdAt || Date.now()).getTime() : 0;
    if (ageMs > 90 * 24 * 60 * 60 * 1000) {
      staleCount += 1;
    }
  }

  const duplicateRetrievals = [...duplicateGroups.values()].filter((count) => count > 1).length;
  const duplicateRate = scoredMatches.length ? duplicateRetrievals / scoredMatches.length : 0;
  const staleRate = scoredMatches.length ? staleCount / scoredMatches.length : 0;
  const lowQualityRate = scoredMatches.length ? lowQualityCount / scoredMatches.length : 0;
  const avgRelevance = clamp(mean(scoredMatches.map((match) => match.retrievalScore)), 0, 1);
  const freshnessScore = clamp(1 - staleRate, 0, 1);
  const diversityScore = clamp(1 - duplicateRate, 0, 1);
  const latencyScore = clamp(1 - Math.min(1, latencyMs / 1500), 0, 1);
  const querySupport = normalizedQuery ? 1 : 0.5;

  const retrievalQualityScore = clamp(
    avgRelevance * 0.48 +
      freshnessScore * 0.16 +
      diversityScore * 0.12 +
      latencyScore * 0.16 +
      querySupport * 0.08 -
      lowQualityRate * 0.12,
    0,
    1,
  );

  return {
    retrievalQualityScore: Number(retrievalQualityScore.toFixed(3)),
    retrievedMemoryRelevance: Number(avgRelevance.toFixed(3)),
    retrievalLatencyMs: Math.max(0, Math.round(latencyMs)),
    duplicateRetrievalCount: duplicateRetrievals,
    duplicateRetrievalRate: Number(duplicateRate.toFixed(3)),
    staleRetrievalCount: staleCount,
    staleRetrievalRate: Number(staleRate.toFixed(3)),
    lowQualityRetrievalCount: lowQualityCount,
    lowQualityRetrievalRate: Number(lowQualityRate.toFixed(3)),
    queryLength: normalizedQuery.length,
    matches: scoredMatches.slice(0, 12),
  };
}

function mergeScoredLabels(existing = [], incoming = [], key = 'label') {
  const merged = new Map();
  for (const item of existing) {
    const label = String(item?.[key] || '').trim();
    if (!label) continue;
    merged.set(label, {
      [key]: label,
      score: finiteNumber(item.score, 0),
      sourceCount: finiteNumber(item.sourceCount, 1),
      lastSeenAt: item.lastSeenAt || new Date(),
      ...item,
    });
  }

  for (const item of incoming) {
    const label = String(item?.[key] || '').trim();
    if (!label) continue;
    const current = merged.get(label) || {
      [key]: label,
      score: 0,
      sourceCount: 0,
      lastSeenAt: new Date(),
    };
    current.score = finiteNumber(current.score, 0) + finiteNumber(item.score, 0);
    current.sourceCount = finiteNumber(current.sourceCount, 0) + finiteNumber(item.sourceCount, 1);
    current.lastSeenAt = item.lastSeenAt || new Date();
    merged.set(label, current);
  }

  return [...merged.values()]
    .sort((left, right) => finiteNumber(right.score, 0) - finiteNumber(left.score, 0))
    .slice(0, 12);
}

function buildInterestProfile({
  profile = null,
  aiProfile = null,
  engagementPattern = null,
  creatorAffinities = [],
  recommendationSignals = [],
  socialGraphEdges = [],
  events = [],
} = {}) {
  const interestLabels = [];
  const communityBuckets = new Map();
  const creatorBuckets = new Map();
  const eventTypeBuckets = new Map();
  const hourBuckets = new Map();

  const profileInterests = [
    ...(profile?.longTerm?.stableInterests || []),
    ...(profile?.midTerm?.recentTopics || []),
    ...(profile?.shortTerm?.activeTopics || []).map((label) => ({ label, score: 0.25 })),
    ...(aiProfile?.topicPreferences || []).map((label) => ({ label, score: 0.25 })),
    ...(recommendationSignals || []).map((signal) => ({ label: signal.category || signal.entityId, score: signal.affinityScore || 0 })),
  ];

  for (const entry of profileInterests) {
    const label = String(entry?.label || '').trim();
    if (!label) continue;
    interestLabels.push({
      label,
      score: finiteNumber(entry.score, 0),
      sourceCount: finiteNumber(entry.sourceCount, 1),
      lastSeenAt: entry.lastSeenAt || new Date(),
    });
  }

  for (const event of events) {
    const hour = new Date(event.occurredAt || Date.now()).getUTCHours();
    hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1);
    eventTypeBuckets.set(event.eventType, (eventTypeBuckets.get(event.eventType) || 0) + 1);

    if (event.creatorId) {
      const key = String(event.creatorId);
      creatorBuckets.set(key, (creatorBuckets.get(key) || 0) + 1);
    }

    if (event.communityId) {
      const key = String(event.communityId);
      communityBuckets.set(key, (communityBuckets.get(key) || 0) + 1);
    }

    (event.interestCandidates || []).forEach((label) => {
      const normalized = normalizeText(label || '');
      if (!normalized) return;
      interestLabels.push({
        label: normalized,
        score: finiteNumber(event.importanceScore, 0.2),
        sourceCount: 1,
        lastSeenAt: event.occurredAt || new Date(),
      });
    });
  }

  for (const edge of socialGraphEdges) {
    for (const communityId of edge.sharedCommunityIds || []) {
      const key = String(communityId);
      communityBuckets.set(key, (communityBuckets.get(key) || 0) + finiteNumber(edge.weight, 0));
    }
  }

  for (const affinity of creatorAffinities) {
    const creatorKey = String(affinity.creatorId || '');
    if (!creatorKey) continue;
    creatorBuckets.set(creatorKey, (creatorBuckets.get(creatorKey) || 0) + finiteNumber(affinity.affinityScore, 0));
  }

  const topInterests = mergeScoredLabels(
    uniqueByKey(interestLabels, (item) => item.label),
    interestLabels,
  ).slice(0, 8);

  const strongestCommunities = [...communityBuckets.entries()]
    .map(([communityId, score]) => ({
      communityId,
      score: Number(score.toFixed ? score.toFixed(3) : score),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const strongestCreators = [...creatorBuckets.entries()]
    .map(([creatorId, score]) => ({
      creatorId,
      score: Number(score.toFixed ? score.toFixed(3) : score),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const activeHoursSource = [
    ...(profile?.longTerm?.activeHours || []),
    ...(engagementPattern?.hourlyHistogram || []).map((entry) => ({
      hour: Number(entry.key),
      score: finiteNumber(entry.score, 0),
    })),
  ];
  const activeHours = mergeScoredLabels(
    activeHoursSource.map((entry) => ({
      label: String(entry.hour),
      score: finiteNumber(entry.score, 0),
      sourceCount: 1,
      lastSeenAt: new Date(),
    })),
    activeHoursSource.map((entry) => ({
      label: String(entry.hour),
      score: finiteNumber(entry.score, 0),
      sourceCount: 1,
      lastSeenAt: new Date(),
    })),
  ).map((entry) => ({
    hour: Number(entry.label),
    score: Number(finiteNumber(entry.score, 0).toFixed(3)),
  }));

  const totalEvents = events.length || finiteNumber(
    Object.values(engagementPattern?.eventTotals || {}).reduce((sum, value) => sum + finiteNumber(value, 0), 0),
    0,
  );
  const watchBehavior = profile?.longTerm?.engagementPatterns || engagementPattern?.watchBehavior || {};
  const watchBias = clamp(finiteNumber(watchBehavior.averageWatchTimeMs, 0) / 45_000, 0, 1);
  const socialBias = clamp(
    (finiteNumber(eventTypeBuckets.get('comment'), 0) +
      finiteNumber(eventTypeBuckets.get('share'), 0) +
      finiteNumber(eventTypeBuckets.get('follow'), 0)) /
      Math.max(totalEvents, 1),
    0,
    1,
  );
  const creatorBias = clamp(
    (creatorAffinities.length + strongestCreators.length) / 10,
    0,
    1,
  );
  const communityBias = clamp(
    (eventTypeBuckets.get('community_join') || 0) / Math.max(totalEvents, 1),
    0,
    1,
  );
  const searchBias = clamp((eventTypeBuckets.get('search') || 0) / Math.max(totalEvents, 1), 0, 1);
  const contentBias = clamp(
    (eventTypeBuckets.get('watch_duration') || 0) / Math.max(totalEvents, 1),
    0,
    1,
  );

  let primaryMode = 'balanced';
  const modeCandidates = [
    ['watch-first', watchBias],
    ['social-first', socialBias],
    ['creator-first', creatorBias],
    ['community-first', communityBias],
    ['search-led', searchBias],
    ['content-led', contentBias],
  ].sort((left, right) => right[1] - left[1]);
  if (modeCandidates[0] && modeCandidates[0][1] >= 0.25) {
    primaryMode = modeCandidates[0][0];
  }

  return {
    topInterests,
    strongestCommunities,
    strongestCreators,
    activeHours: activeHours.sort((left, right) => right.score - left.score),
    engagementStyle: {
      primaryMode,
      watchBias: Number(watchBias.toFixed(3)),
      socialBias: Number(socialBias.toFixed(3)),
      creatorBias: Number(creatorBias.toFixed(3)),
      communityBias: Number(communityBias.toFixed(3)),
      searchBias: Number(searchBias.toFixed(3)),
      contentBias: Number(contentBias.toFixed(3)),
      watchTimeMs: finiteNumber(watchBehavior.averageWatchTimeMs, 0),
      scrollDurationMs: finiteNumber(watchBehavior.averageScrollDurationMs, 0),
      rewatchProbability: finiteNumber(watchBehavior.rewatchProbability, 0),
      engagementVelocity: finiteNumber(engagementPattern?.engagementVelocity, 0),
    },
  };
}

function buildEventQualityDashboard({
  events = [],
  metrics = {},
  queueHealth = {},
  failedEmbeddings = [],
  retrievalQuality = null,
} = {}) {
  const totalEvents = events.length;
  const duplicateSuppressedEvents = events.reduce((sum, event) => sum + finiteNumber(event.duplicateCount, 0), 0);
  const shouldEmbedCount = events.filter((event) => event.shouldEmbed).length;
  const processedCount = events.filter((event) => event.processingStatus === 'processed').length;
  const failedCount = events.filter((event) => event.processingStatus === 'failed').length;
  const skippedCount = events.filter((event) => event.processingStatus === 'skipped').length;
  const eventBytes = mean(events.map(estimateDocumentSizeBytes));
  const embeddingBytes = mean(failedEmbeddings.map(estimateDocumentSizeBytes));
  const durationSnapshot = metrics?.durations || {};
  const ingestionLatencyMs = finiteNumber(durationSnapshot.eventIngestRequest?.p95Ms, 0);
  const processingLatencyMs = finiteNumber(durationSnapshot.eventProcessing?.p95Ms, 0);
  const embeddingLatencyMs = finiteNumber(durationSnapshot.embeddingGeneration?.p95Ms, 0);
  const retrievalLatencyMs = finiteNumber(retrievalQuality?.retrievalLatencyMs, durationSnapshot.memoryRetrieval?.p95Ms || 0);
  const queueSnapshot = queueHealth?.queues || {};

  const recentSpanMs = events.length > 1
    ? new Date(events[0].occurredAt || Date.now()).getTime() - new Date(events[events.length - 1].occurredAt || Date.now()).getTime()
    : 24 * 60 * 60 * 1000;
  const days = Math.max(recentSpanMs / (24 * 60 * 60 * 1000), 1);
  const throughputPerDay = totalEvents / days;
  const embeddingPressurePerDay = shouldEmbedCount / days;
  const memoryGrowthPerDayBytes = (eventBytes * throughputPerDay) + (embeddingBytes * Math.max(embeddingPressurePerDay, 0));

  return {
    eventThroughput: {
      totalEvents,
      throughputPerDay: Number(throughputPerDay.toFixed(2)),
      processedCount,
      failedCount,
      skippedCount,
    },
    duplicateSuppression: {
      duplicateSuppressedEvents,
      duplicateSuppressionRate: Number(
        (totalEvents ? duplicateSuppressedEvents / totalEvents : 0).toFixed(3),
      ),
      shouldEmbedRate: Number((totalEvents ? shouldEmbedCount / totalEvents : 0).toFixed(3)),
    },
    queueHealth: queueSnapshot,
    queueSnapshot: getQueueState(),
    failedEmbeddings: {
      count: failedEmbeddings.length,
      items: failedEmbeddings.slice(0, 10),
    },
    latency: {
      ingestionLatencyMs,
      processingLatencyMs,
      embeddingLatencyMs,
      retrievalLatencyMs,
    },
    memoryGrowth: {
      averageEventBytes: Math.round(eventBytes),
      averageFailedEmbeddingBytes: Math.round(embeddingBytes),
      estimatedDailyGrowthBytes: Math.round(memoryGrowthPerDayBytes),
      estimatedDailyGrowthMb: Number((memoryGrowthPerDayBytes / (1024 * 1024)).toFixed(3)),
    },
  };
}

function buildMemoryOptimizationStrategy({
  profile = null,
  events = [],
  embeddings = [],
} = {}) {
  const memorySummaries = profile?.memorySummaries || [];
  const duplicateEventCount = events.reduce((sum, event) => sum + finiteNumber(event.duplicateCount, 0), 0);
  const lowImportanceEvents = events.filter((event) => finiteNumber(event.importanceScore, 0) < 0.3);
  const oldLowImportanceEvents = lowImportanceEvents.filter(
    (event) => Date.now() - new Date(event.occurredAt || Date.now()).getTime() > 14 * 24 * 60 * 60 * 1000,
  );

  return {
    staleMemoryCleanup: [
      'Prune short-term context older than 30 days.',
      'Keep only the most recent 20 short-term context entries.',
      'Drop failed or stale embeddings from manual review once they are older than the retention window.',
    ],
    rollingSummaries: [
      `Keep the last ${getYmeConfig().consolidation.recentContextLimit || 20} recent context entries and roll them into memory summaries on consolidation.`,
      'Merge duplicate long-term summaries before storing the next summary snapshot.',
      'Rotate summaries by importance, not just recency.',
    ],
    duplicateMemoryMerging: [
      `Detected ${duplicateEventCount} duplicate event suppressions in the current sample.`,
      'Merge repeated topic labels and creator references before promoting them to stable interests.',
    ],
    lowQualityPruning: [
      `${lowImportanceEvents.length} low-importance events in the current sample.`,
      `${oldLowImportanceEvents.length} low-importance events are older than 14 days and are safe pruning candidates.`,
    ],
    retentionPolicies: [
      'Retain high-importance event memory longer than low-importance event memory.',
      'Keep failed embeddings as inspection artifacts, but exclude them from retrieval candidates.',
      'Prefer summary retention over raw-event retention once a topic has been consolidated.',
    ],
    archivalLogic: [
      'Archive old low-value event batches as summary strings instead of retaining full raw payloads.',
      'Move repeated, stale topic labels into the summary layer only after they stabilize.',
      `Current summary count: ${memorySummaries.length}; consider capping at 12, which the consolidation flow already enforces.`,
    ],
    sampleEmbeddingCacheHits: embeddings.filter((embedding) => finiteNumber(embedding.cacheHitCount, 0) > 0).length,
  };
}

function buildCostProtectionStrategy({
  config = getYmeConfig(),
  metrics = {},
  eventQuality = null,
  retrievalQuality = null,
  embeddings = [],
} = {}) {
  const durationSnapshot = metrics?.durations || {};
  const recentEmbeddingRate = finiteNumber(eventQuality?.duplicateSuppression?.shouldEmbedRate, 0);
  const cacheHits = embeddings.filter((embedding) => finiteNumber(embedding.cacheHitCount, 0) > 0).length;
  const retrievalPressure = finiteNumber(retrievalQuality?.retrievalQualityScore, 0);

  return {
    embeddingThrottling: [
      `Direct embeddings are gated by importance threshold ${config.embedding.directEventImportanceThreshold}.`,
      `Worker throttling is capped at ${config.queue.embeddingRateMax} jobs per ${Math.round(config.queue.embeddingRateWindowMs / 1000)}s.`,
      `Minimum embedding request spacing is ${config.embedding.minRequestIntervalMs}ms.`,
    ],
    memoryBatching: [
      'Chat summaries are embedded as rolling windows instead of per-message bursts.',
      'Consolidation can queue embedding refreshes only after summaries are stabilized.',
      'Queue fan-out keeps event ingestion, consolidation, and embeddings on separate paths.',
    ],
    retrievalCaching: [
      `Embeddings with cache hits observed: ${cacheHits}.`,
      'contentHash prevents repeated source text from regenerating embeddings when the content is unchanged.',
      `Retrieval quality score in the sample is ${retrievalPressure.toFixed(3)}; improve retrieval reuse before increasing embedding volume.`,
    ],
    eventRateControls: [
      `API event rate limit: ${config.api.eventRateLimitPerMinute}/minute.`,
      `Batch event rate limit: ${config.api.batchRateLimitPerMinute}/minute.`,
      `Retrieval rate limit: ${config.api.retrievalRateLimitPerMinute}/minute.`,
      `Queue mode: ${config.queue.mode}; inline mode is a fallback only.`,
    ],
    pressureIndicators: {
      embeddingGenerationP95Ms: finiteNumber(durationSnapshot.embeddingGeneration?.p95Ms, 0),
      memoryRetrievalP95Ms: finiteNumber(durationSnapshot.memoryRetrieval?.p95Ms, 0),
      shouldEmbedRate: Number(recentEmbeddingRate.toFixed(3)),
    },
  };
}

function buildProductionReadinessReport({
  config = getYmeConfig(),
  metrics = {},
  queueHealth = {},
  eventQuality = null,
  signalCalibration = null,
  retrievalQuality = null,
  costProtection = null,
  memoryOptimization = null,
  totalUsers = 0,
} = {}) {
  const queueState = getQueueState();
  const durations = metrics?.durations || {};
  const queueCounts = queueHealth?.queues || {};
  const queueWaitingTotal = Object.values(queueCounts).reduce(
    (sum, counts) => sum + finiteNumber(counts.waiting || counts.pending || 0, 0),
    0,
  );
  const queueFailedTotal = Object.values(queueCounts).reduce(
    (sum, counts) => sum + finiteNumber(counts.failed || 0, 0),
    0,
  );
  const duplicateFrequency = finiteNumber(eventQuality?.duplicateSuppression?.duplicateSuppressionRate, 0);
  const retrievalScore = finiteNumber(retrievalQuality?.retrievalQualityScore, 0);
  const ingestionP95 = finiteNumber(durations.eventIngestRequest?.p95Ms, 0);
  const processingP95 = finiteNumber(durations.eventProcessing?.p95Ms, 0);
  const embeddingP95 = finiteNumber(durations.embeddingGeneration?.p95Ms, 0);
  const matureEnoughForRollout =
    retrievalScore >= 0.55 &&
    duplicateFrequency <= 0.2 &&
    queueFailedTotal === 0 &&
    embeddingP95 < 2500;

  const scalingBottlenecks = [];
  if (!queueState.enabled) scalingBottlenecks.push('Queue layer is disabled or not connected.');
  if (queueWaitingTotal > 0) scalingBottlenecks.push(`Queue backlog detected (${queueWaitingTotal} waiting jobs across queues).`);
  if (queueFailedTotal > 0) scalingBottlenecks.push(`Queue failure count is non-zero (${queueFailedTotal}).`);
  if (duplicateFrequency > 0.2) scalingBottlenecks.push('Duplicate suppression rate is high enough to revisit client dedupe and event gating.');
  if (retrievalScore < 0.55) scalingBottlenecks.push('Retrieval quality is below the target threshold; lower-quality memories should be pruned before adding more volume.');
  if (embeddingP95 > 2500) scalingBottlenecks.push('Embedding latency is high enough to limit volume until throttles or batch sizes are tuned.');
  if (ingestionP95 > 1500) scalingBottlenecks.push('Ingestion request latency is rising and should be watched before broadening event capture.');
  if (processingP95 > 2500) scalingBottlenecks.push('Event processing latency is high; consolidation or embedding fan-out may need more headroom.');

  const eventGrowth = finiteNumber(eventQuality?.eventThroughput?.throughputPerDay, 0);
  const dailyGrowthMb = finiteNumber(eventQuality?.memoryGrowth?.estimatedDailyGrowthMb, 0);
  const monthlyGrowthMb = dailyGrowthMb * 30;
  const vertexEmbeddingPressure =
    finiteNumber(signalCalibration?.strongestSignals?.length, 0) +
    finiteNumber(eventQuality?.duplicateSuppression?.shouldEmbedRate, 0) * 10;

  return {
    maturityAssessment: {
      stage: matureEnoughForRollout ? 'Phase 3 - visibility-first production hardening' : 'Phase 3 - tuning required before broad rollout',
      readyForLimitedRollout: matureEnoughForRollout,
      totalUsers,
      signalQuality: finiteNumber(signalCalibration?.strongestSignals?.length, 0) > 0 ? 'measured' : 'insufficient sample',
    },
    scalingBottlenecks,
    mongoGrowthProjection: {
      estimatedDailyGrowthMb: Number(dailyGrowthMb.toFixed(3)),
      estimatedMonthlyGrowthMb: Number(monthlyGrowthMb.toFixed(3)),
      eventGrowthPerDay: Number(eventGrowth.toFixed(2)),
      note: 'Heuristic projection based on the current inspection sample and average document size.',
    },
    vertexAiCostProjection: {
      embeddingPressureScore: Number(vertexEmbeddingPressure.toFixed(3)),
      requestPressure: embeddingP95 > 1500 ? 'high' : embeddingP95 > 800 ? 'medium' : 'low',
      note: 'This is a relative cost-pressure estimate, not a live pricing quote.',
    },
    queueScalingRisks: [
      queueState.enabled ? 'Queue mode is active and can absorb spikes if Redis stays healthy.' : 'Queue mode is disabled; inline processing limits headroom.',
      queueWaitingTotal > 0 ? 'Backlog exists and should be drained before widening ingestion.' : 'No queue backlog detected in the current sample.',
      queueFailedTotal > 0 ? 'Failed queue jobs should be inspected before rollout.' : 'No queue failure spike was observed in the current sample.',
    ],
    rolloutStrategy: [
      'Keep the inspector read-only until event quality and retrieval quality stay stable for several production windows.',
      'Roll out remaining Android hooks behind event allowlists, not catch-all capture.',
      'Increase embedding volume only after duplicate suppression and queue lag remain low.',
      'Prefer more retrieval quality and better consolidation over more memory quantity.',
    ],
    safeProductionChecklist: [
      'Keep admin analytics access restricted.',
      'Keep direct embedding gated by importance and summary eligibility.',
      'Monitor queue wait, queue failures, and retrieval quality together.',
      'Review duplicate suppression before enabling new event types.',
      'Prune low-importance memories and stale embeddings on a rolling cadence.',
      'Backfill only the event types with clear user intent.',
    ],
    costProtectionStrategy: costProtection,
    memoryOptimizationStrategy: memoryOptimization,
  };
}

async function buildInspectorOverview({
  userId = '',
  query = '',
  limit = 30,
} = {}) {
  const normalizedUserId = String(userId || '').trim();
  const objectId = normalizedUserId ? safeObjectId(normalizedUserId) : null;
  const sampleLimit = Math.min(100, Math.max(10, Number(limit || 30)));
  const metrics = getMetricsSnapshot();

  const [
    queueHealth,
    globalEvents,
    userEvents,
    globalLogs,
    userLogs,
    globalEmbeddings,
    userEmbeddings,
    failedEmbeddings,
    profile,
    user,
    recentChatSummaries,
    engagementPattern,
    creatorAffinities,
    recommendationSignals,
    socialGraphEdges,
    aiProfile,
  ] = await Promise.all([
    getQueueHealth().catch(() => ({})),
    UserEvent.find({})
      .sort({ occurredAt: -1 })
      .limit(sampleLimit)
      .lean(),
    objectId
      ? UserEvent.find({ userId: objectId }).sort({ occurredAt: -1 }).limit(sampleLimit).lean()
      : Promise.resolve([]),
    MemoryLog.find({}).sort({ createdAt: -1 }).limit(sampleLimit).lean(),
    objectId
      ? MemoryLog.find({ userId: objectId }).sort({ createdAt: -1 }).limit(sampleLimit).lean()
      : Promise.resolve([]),
    MemoryEmbedding.find({}).sort({ updatedAt: -1 }).limit(sampleLimit).lean(),
    objectId
      ? MemoryEmbedding.find({ userId: objectId }).sort({ updatedAt: -1 }).limit(sampleLimit).lean()
      : Promise.resolve([]),
    MemoryEmbedding.find({ status: 'failed' }).sort({ updatedAt: -1 }).limit(sampleLimit).lean(),
    objectId ? UserMemory.findOne({ userId: objectId }).lean() : Promise.resolve(null),
    objectId
      ? User.findById(objectId)
          .select('username displayName name walletId verified roleName publicRoles')
          .lean()
      : Promise.resolve(null),
    objectId
      ? ChatSummary.find({ userId: objectId }).sort({ updatedAt: -1 }).limit(5).lean()
      : Promise.resolve([]),
    objectId ? EngagementPattern.findOne({ userId: objectId }).lean() : Promise.resolve(null),
    objectId
      ? CreatorAffinity.find({ userId: objectId }).sort({ affinityScore: -1 }).limit(10).lean()
      : Promise.resolve([]),
    objectId
      ? RecommendationSignal.find({ userId: objectId }).sort({ affinityScore: -1 }).limit(12).lean()
      : Promise.resolve([]),
    objectId ? SocialGraph.find({ userId: objectId }).sort({ weight: -1 }).limit(12).lean() : Promise.resolve([]),
    objectId ? AIProfile.findOne({ userId: objectId }).lean() : Promise.resolve(null),
  ]);
  const userFailedEmbeddings = objectId
    ? await MemoryEmbedding.find({ userId: objectId, status: 'failed' })
        .sort({ updatedAt: -1 })
        .limit(sampleLimit)
        .lean()
    : [];

  let retrieval = null;
  let retrievalLatencyMs = 0;
  if (objectId) {
    const retrievalStartedAt = Date.now();
    retrieval = await retrieveUserMemoryContext({
      userId: objectId,
      query,
      limit: Math.min(12, sampleLimit),
    });
    retrievalLatencyMs = Date.now() - retrievalStartedAt;
  }

  const signalCalibration = buildSignalCalibration(objectId ? userEvents : globalEvents);
  const retrievalQuality = buildRetrievalQuality({
    matches: retrieval?.matches || [],
    embeddings: objectId ? userEmbeddings : globalEmbeddings,
    query,
    latencyMs: retrievalLatencyMs,
  });
  const interestProfile = buildInterestProfile({
    profile,
    aiProfile,
    engagementPattern,
    creatorAffinities,
    recommendationSignals,
    socialGraphEdges,
    events: objectId ? userEvents : globalEvents,
  });
  const eventQuality = buildEventQualityDashboard({
    events: objectId ? userEvents : globalEvents,
    metrics,
    queueHealth,
    failedEmbeddings: objectId ? userFailedEmbeddings : failedEmbeddings,
    retrievalQuality,
  });
  const costProtection = buildCostProtectionStrategy({
    config: getYmeConfig(),
    metrics,
    eventQuality,
    retrievalQuality,
    embeddings: objectId ? userEmbeddings : globalEmbeddings,
  });
  const memoryOptimization = buildMemoryOptimizationStrategy({
    profile,
    events: objectId ? userEvents : globalEvents,
    embeddings: objectId ? userEmbeddings : globalEmbeddings,
  });
  const totalUsers = await UserMemory.countDocuments({}).catch(() => 0);
  const productionReadiness = buildProductionReadinessReport({
    config: getYmeConfig(),
    metrics,
    queueHealth,
    eventQuality,
    signalCalibration,
    retrievalQuality,
    costProtection,
    memoryOptimization,
    totalUsers,
  });

  const recentEvents = (objectId ? userEvents : globalEvents).map((event) => ({
    ...event,
    signalStrengthScore: buildEventSignalScore(event),
  }));

  const recentLogs = objectId ? userLogs : globalLogs;
  const recentEmbeddings = objectId ? userEmbeddings : globalEmbeddings;

  return {
    scope: objectId ? 'user' : 'system',
    userId: normalizedUserId,
    user: user
      ? {
          id: String(user._id || normalizedUserId),
          username: user.username || '',
          displayName: user.displayName || user.name || '',
          walletId: user.walletId || '',
          verified: Boolean(user.verified),
          roleName: user.roleName || '',
        }
      : null,
    profile,
    recentChatSummaries,
    recentEvents,
    recentLogs,
    recentEmbeddings,
    failedEmbeddings: objectId ? userFailedEmbeddings : failedEmbeddings,
    system: {
      metrics,
      queueHealth,
      queueState: getQueueState(),
      productionReadiness,
      eventQuality,
      costProtection,
      memoryOptimization,
    },
    signalCalibration,
    retrievalQuality,
    interestProfile,
    eventQuality,
    productionReadiness,
    costProtection,
    memoryOptimization,
    userInspection: objectId
      ? {
          query,
          retrieval,
          retrievalQuality,
          signalCalibration,
          interestProfile,
        }
      : null,
    profileArtifacts: {
      memorySummaries: profile?.memorySummaries || [],
      shortTerm: profile?.shortTerm || {},
      midTerm: profile?.midTerm || {},
      longTerm: profile?.longTerm || {},
      aiProfile: aiProfile || profile?.longTerm?.aiProfile || {},
      engagementPattern,
      creatorAffinities,
      recommendationSignals,
      socialGraphEdges,
    },
  };
}

module.exports = {
  buildInspectorOverview,
  buildSignalCalibration,
  buildRetrievalQuality,
  buildInterestProfile,
  buildEventQualityDashboard,
  buildCostProtectionStrategy,
  buildMemoryOptimizationStrategy,
  buildProductionReadinessReport,
};
