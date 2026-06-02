const ModerationItem = require('../../../models/ModerationItem.model');
const { publishYmeEvent } = require('../../yme/services/eventPublisher.service');

const LIVESTREAM_EVENT_TYPES = Object.freeze({
  STREAM_STARTED: 'STREAM_STARTED',
  STREAM_ENDED: 'STREAM_ENDED',
  STREAM_JOINED: 'STREAM_JOINED',
  STREAM_LEFT: 'STREAM_LEFT',
  STREAM_COMMENT: 'STREAM_COMMENT',
  STREAM_LIKE: 'STREAM_LIKE',
  STREAM_GIFT: 'STREAM_GIFT',
  STREAM_SHARE: 'STREAM_SHARE',
  STREAM_REPORT: 'STREAM_REPORT',
  STREAM_FOLLOW_HOST: 'STREAM_FOLLOW_HOST',
  STREAM_PIN_COMMENT: 'STREAM_PIN_COMMENT',
  STREAM_MODERATION_ACTION: 'STREAM_MODERATION_ACTION',
  STREAM_BAN_USER: 'STREAM_BAN_USER',
  STREAM_WARNING: 'STREAM_WARNING',
  STREAM_VIEW_DURATION: 'STREAM_VIEW_DURATION',
  STREAM_PEAK_VIEWERS: 'STREAM_PEAK_VIEWERS',
});

const RATE_WINDOW_MS = 60000;
const streamMetrics = new Map();

function nowIso(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeId(value) {
  return value?.toString?.() || String(value || '');
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pruneWindow(values, timestampMs) {
  const cutoff = timestampMs - RATE_WINDOW_MS;
  while (values.length && values[0] < cutoff) values.shift();
  return values.length;
}

function getMetricsState(streamId) {
  const normalizedStreamId = normalizeId(streamId);
  if (!streamMetrics.has(normalizedStreamId)) {
    streamMetrics.set(normalizedStreamId, {
      streamId: normalizedStreamId,
      totalViewers: 0,
      concurrentViewers: 0,
      peakViewers: 0,
      watchTime: 0,
      averageWatchTime: 0,
      retentionRate: 0,
      giftRevenue: 0,
      engagementCount: 0,
      joinedUsers: new Set(),
      activeUsers: new Set(),
      retainedUsers: new Set(),
      watchDurations: new Map(),
      topGifters: new Map(),
      windows: {
        comments: [],
        likes: [],
        gifts: [],
      },
    });
  }
  return streamMetrics.get(normalizedStreamId);
}

function publicMetrics(state) {
  const totalViewers = Math.max(0, state.totalViewers);
  const topGifters = Array.from(state.topGifters.entries())
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    streamId: state.streamId,
    totalViewers,
    concurrentViewers: Math.max(0, state.concurrentViewers),
    peakViewers: Math.max(0, state.peakViewers),
    commentsPerMinute: state.commentsPerMinute || 0,
    likesPerMinute: state.likesPerMinute || 0,
    giftsPerMinute: state.giftsPerMinute || 0,
    watchTime: state.watchTime,
    averageWatchTime: state.averageWatchTime,
    retentionRate: state.retentionRate,
    giftRevenue: state.giftRevenue,
    topGifters,
    engagementCount: state.engagementCount,
  };
}

function updateLivestreamMetrics(event) {
  const state = getMetricsState(event.streamId);
  const metadata = event.metadata || {};
  const timestampMs = new Date(event.timestamp).getTime() || Date.now();
  const userId = normalizeId(event.userId);

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_JOINED && userId) {
    state.joinedUsers.add(userId);
    state.activeUsers.add(userId);
    state.totalViewers = state.joinedUsers.size;
    state.concurrentViewers = safeNumber(metadata.concurrentViewers, state.activeUsers.size);
    state.peakViewers = Math.max(state.peakViewers, state.concurrentViewers);
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_LEFT && userId) {
    state.activeUsers.delete(userId);
    state.concurrentViewers = safeNumber(metadata.concurrentViewers, state.activeUsers.size);
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_PEAK_VIEWERS) {
    state.concurrentViewers = safeNumber(metadata.concurrentViewers, state.concurrentViewers);
    state.peakViewers = Math.max(state.peakViewers, safeNumber(metadata.peakViewers, state.peakViewers));
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_COMMENT) {
    state.engagementCount += 1;
    state.commentsPerMinute = pruneWindow(state.windows.comments, timestampMs);
    state.windows.comments.push(timestampMs);
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_LIKE) {
    state.engagementCount += 1;
    state.likesPerMinute = pruneWindow(state.windows.likes, timestampMs);
    state.windows.likes.push(timestampMs);
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_GIFT) {
    const amount = safeNumber(metadata.amount);
    state.engagementCount += 1;
    state.giftRevenue += amount;
    state.giftsPerMinute = pruneWindow(state.windows.gifts, timestampMs);
    state.windows.gifts.push(timestampMs);
    if (userId) {
      state.topGifters.set(userId, safeNumber(state.topGifters.get(userId)) + amount);
    }
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION && userId) {
    const durationMs = safeNumber(metadata.durationMs || metadata.watchTimeMs);
    state.watchDurations.set(userId, durationMs);
    state.watchTime = Array.from(state.watchDurations.values()).reduce((sum, value) => sum + value, 0);
    state.averageWatchTime = state.watchDurations.size ? Math.round(state.watchTime / state.watchDurations.size) : 0;
    if (durationMs >= 60000) state.retainedUsers.add(userId);
    state.retentionRate = state.joinedUsers.size
      ? Number((state.retainedUsers.size / state.joinedUsers.size).toFixed(4))
      : 0;
  }

  state.commentsPerMinute = pruneWindow(state.windows.comments, timestampMs);
  state.likesPerMinute = pruneWindow(state.windows.likes, timestampMs);
  state.giftsPerMinute = pruneWindow(state.windows.gifts, timestampMs);

  return publicMetrics(state);
}

function buildLivestreamOperationalEvent({
  eventType,
  streamId,
  userId,
  hostId,
  timestamp,
  metadata = {},
}) {
  return {
    eventType,
    streamId: normalizeId(streamId),
    userId: normalizeId(userId),
    hostId: normalizeId(hostId),
    timestamp: nowIso(timestamp || metadata.createdAt),
    metadata: {
      ...metadata,
      streamId: normalizeId(streamId),
      hostId: normalizeId(hostId),
    },
  };
}

function detectLivestreamModerationSignals(event, metrics) {
  const signals = [];
  const metadata = event.metadata || {};
  const text = String(metadata.message || metadata.reason || '').trim();

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_REPORT) {
    signals.push({
      category: 'abuse_report',
      reason: metadata.reason || 'Livestream report submitted.',
      severity: 'medium',
    });
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_COMMENT) {
    const repeated = /(.)\1{7,}/i.test(text);
    const links = (text.match(/https?:\/\/|www\./gi) || []).length;
    if (repeated || links >= 2 || metrics.commentsPerMinute >= 25) {
      signals.push({
        category: 'spam_comment',
        reason: 'Potential livestream comment spam.',
        severity: metrics.commentsPerMinute >= 25 ? 'high' : 'medium',
      });
    }
  }

  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_GIFT) {
    const amount = safeNumber(metadata.amount);
    if (amount >= 5000 || metrics.giftsPerMinute >= 12) {
      signals.push({
        category: 'gift_fraud',
        reason: 'Potential livestream gift fraud or abnormal gifting velocity.',
        severity: amount >= 10000 ? 'high' : 'medium',
      });
    }
  }

  if (
    event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_JOINED &&
    metrics.concurrentViewers >= 100 &&
    metrics.concurrentViewers > Math.max(10, metrics.totalViewers * 0.9)
  ) {
    signals.push({
      category: 'bot_viewers',
      reason: 'Potential synthetic livestream viewer burst.',
      severity: 'medium',
    });
  }

  if (metrics.likesPerMinute >= 120 || metrics.commentsPerMinute >= 60 || metrics.giftsPerMinute >= 20) {
    signals.push({
      category: 'suspicious_engagement_spike',
      reason: 'Livestream engagement velocity crossed moderation threshold.',
      severity: 'high',
    });
  }

  return signals;
}

async function enqueueLivestreamModerationSignals(event, signals) {
  if (!signals.length) return [];

  const items = await Promise.all(
    signals.map((signal) =>
      ModerationItem.create({
        type: 'system_flag',
        targetUserId: event.hostId || null,
        reportedBy: event.userId || null,
        reason: signal.reason,
        status: 'pending',
        metadata: {
          source: 'livestream_operational_intelligence',
          eventType: event.eventType,
          streamId: event.streamId,
          hostId: event.hostId,
          userId: event.userId,
          category: signal.category,
          severity: signal.severity,
          eventMetadata: event.metadata,
        },
        createdBy: 'system',
      }),
    ),
  );

  return items;
}

function buildRecommendationSignals(event) {
  const metadata = event.metadata || {};
  const signals = [];
  if (metadata.community) signals.push(`community:${metadata.community}`);
  if (metadata.category) signals.push(`category:${metadata.category}`);
  if (metadata.title) signals.push(`stream_title:${metadata.title}`);
  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_GIFT) signals.push('creator_gifting');
  if (event.eventType === LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION) signals.push('watch_duration');
  return signals;
}

async function emitLivestreamOperationalEvent(input, options = {}) {
  const event = buildLivestreamOperationalEvent(input);
  if (!event.eventType || !event.streamId || !event.userId) return null;

  const metrics = updateLivestreamMetrics(event);
  const moderationSignals = detectLivestreamModerationSignals(event, metrics);
  const moderationItems = await enqueueLivestreamModerationSignals(event, moderationSignals);
  const recommendationSignals = buildRecommendationSignals(event);

  const enrichedMetadata = {
    ...event.metadata,
    operationalSchema: 'livestream.v1',
    metrics,
    moderationSignals,
    moderationItemIds: moderationItems.map((item) => item._id.toString()),
    recommendationSignals,
  };

  publishYmeEvent(
    {
      userId: event.userId,
      relatedUserId: event.hostId,
      creatorId: event.hostId,
      sourceApp: 'livestream',
      platform: options.platform || 'server',
      sessionId: options.sessionId || '',
      clientEventId: event.metadata.clientEventId || '',
      eventType: event.eventType,
      contentId: event.streamId,
      postId: event.streamId,
      timestamp: event.timestamp,
      occurredAt: event.timestamp,
      text: event.metadata.message || event.metadata.reason || '',
      payload: enrichedMetadata,
      metadata: enrichedMetadata,
    },
    options.publishOptions || {},
  );

  return {
    ...event,
    metadata: enrichedMetadata,
  };
}

function getLivestreamMetrics(streamId) {
  const normalizedStreamId = normalizeId(streamId);
  const state = streamMetrics.get(normalizedStreamId);
  return state ? publicMetrics(state) : publicMetrics(getMetricsState(normalizedStreamId));
}

function getTopStreams(limit = 20) {
  return Array.from(streamMetrics.values())
    .map(publicMetrics)
    .sort((a, b) => {
      const aScore = a.peakViewers + a.engagementCount + a.giftRevenue;
      const bScore = b.peakViewers + b.engagementCount + b.giftRevenue;
      return bScore - aScore;
    })
    .slice(0, Math.max(1, Number(limit) || 20));
}

module.exports = {
  LIVESTREAM_EVENT_TYPES,
  buildLivestreamOperationalEvent,
  emitLivestreamOperationalEvent,
  getLivestreamMetrics,
  getTopStreams,
  updateLivestreamMetrics,
};
