const MonetizationDaily = require('../models/monetizationDaily.model');
const MonetizationEvent = require('../models/monetizationEvent.model');
const {
  normalizeCountryLabel,
  resolveRewardCountry,
  recordRegionalRewardDaily
} = require('./regionalRewards.service');

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePlatform(platform) {
  return (platform || 'android').toString().trim().toLowerCase();
}

function normalizeEventType(type) {
  return (type || '').toString().trim().toLowerCase();
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sanitizePayload(input = {}) {
  const date = (input.date || todayUtc()).toString().trim();
  const platform = normalizePlatform(input.platform);
  const country = normalizeCountryLabel(input.country || 'Ghana') || 'Ghana';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const err = new Error('date must use YYYY-MM-DD format');
    err.statusCode = 400;
    throw err;
  }

  if (!['android', 'web'].includes(platform)) {
    const err = new Error('platform must be android or web');
    err.statusCode = 400;
    throw err;
  }

  return {
    date,
    platform,
    country,
    eventType: normalizeEventType(input.eventType),
    adId: (input.adId || '').toString().trim(),
    postId: (input.postId || '').toString().trim(),
    placement: (input.placement || '').toString().trim().toLowerCase(),
    durationMs: safeNumber(input.durationMs),
    skipped: Boolean(input.skipped),
    completed: Boolean(input.completed),
    failed: Boolean(input.failed),
    rewarded: Boolean(input.rewarded),
    monetizedSession: Boolean(input.monetizedSession),
    creatorUserId: (input.creatorUserId || '').toString().trim()
  };
}

async function upsertMonetizationDailyMetrics(input = {}, user = null) {
  const metric = sanitizePayload(input);
  const countrySource = user
    ? resolveRewardCountry(user)
    : { country: metric.country, confidence: 0, source: 'client' };
  const resolvedCountry = countrySource.country || metric.country;

  const increments = {
    totalAdImpressions: 0,
    rewardedAdsCompleted: 0,
    midRollAdsShown: 0,
    interstitialAdsShown: 0,
    adWatchDuration: 0,
    skippedAds: 0,
    monetizedPlaybackSessions: 0
  };

  switch (metric.eventType) {
    case 'impression':
    case 'shown':
    case 'ad_shown':
      increments.totalAdImpressions = 1;
      if (metric.placement === 'midroll') {
        increments.midRollAdsShown = 1;
      } else if (metric.placement === 'interstitial') {
        increments.interstitialAdsShown = 1;
      }
      if (metric.monetizedSession) {
        increments.monetizedPlaybackSessions = 1;
      }
      break;
    case 'completed':
    case 'rewarded_completed':
      increments.rewardedAdsCompleted = metric.rewarded || metric.placement === 'rewarded' ? 1 : 0;
      if (metric.durationMs > 0) {
        increments.adWatchDuration = metric.durationMs;
      }
      break;
    case 'skipped':
      increments.skippedAds = 1;
      if (metric.durationMs > 0) {
        increments.adWatchDuration = metric.durationMs;
      }
      break;
    case 'failed':
      if (metric.durationMs > 0) {
        increments.adWatchDuration = metric.durationMs;
      }
      break;
    case 'session_start':
      increments.monetizedPlaybackSessions = 1;
      break;
    default:
      if (metric.durationMs > 0) {
        increments.adWatchDuration = metric.durationMs;
      }
      break;
  }

  const saved = await MonetizationDaily.findOneAndUpdate(
    { date: metric.date, platform: metric.platform, country: resolvedCountry },
    {
      $inc: increments,
      $setOnInsert: {
        date: metric.date,
        platform: metric.platform,
        country: resolvedCountry
      }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  try {
    await MonetizationEvent.create({
      userId: user?._id || null,
      creatorUserId: metric.creatorUserId || null,
      adId: metric.adId,
      postId: metric.postId,
      eventType: metric.eventType,
      placement: metric.placement,
      platform: metric.platform,
      country: resolvedCountry,
      durationMs: metric.durationMs,
      skipped: metric.skipped,
      completed: metric.completed,
      failed: metric.failed,
      rewarded: metric.rewarded,
      monetizedSession: metric.monetizedSession,
      metadata: {
        countrySource: countrySource.source || '',
        countryConfidence: countrySource.confidence || 0
      }
    });
  } catch (eventErr) {
    console.warn('[MonetizationAnalytics] event insert failed:', eventErr.message);
  }

  await recordRegionalRewardDaily({
    country: resolvedCountry,
    platform: metric.platform,
    impressions: increments.totalAdImpressions,
    requests: metric.eventType === 'impression' || metric.eventType === 'shown' ? 1 : 0,
    adRevenue: 0,
    verifiedCountry: user?.verifiedCountry || '',
    detectedCountry: user?.detectedCountry || '',
    countryConfidence: user?.countryConfidence || countrySource.confidence || 0,
    metadata: {
      source: 'monetizationAnalytics.event',
      eventType: metric.eventType,
      placement: metric.placement,
      adId: metric.adId || null,
      postId: metric.postId || null,
      durationMs: metric.durationMs,
      skipped: metric.skipped,
      completed: metric.completed,
      failed: metric.failed,
      rewarded: metric.rewarded,
      monetizedSession: metric.monetizedSession,
      creatorUserId: metric.creatorUserId || null
    }
  });

  return saved;
}

module.exports = {
  upsertMonetizationDailyMetrics
};
