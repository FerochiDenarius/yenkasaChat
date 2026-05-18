const MonetizationDaily = require('../models/monetizationDaily.model');
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
    rewarded: Boolean(input.rewarded),
    monetizedSession: Boolean(input.monetizedSession)
  };
}

async function upsertMonetizationDailyMetrics(input = {}, user = null) {
  const metric = sanitizePayload(input);
  const countrySource = user
    ? resolveRewardCountry(user)
    : { country: metric.country, confidence: 0, source: 'client' };

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
      increments.totalAdImpressions = 1;
      increments.rewardedAdsCompleted = metric.rewarded || metric.placement === 'rewarded' ? 1 : 0;
      if (metric.durationMs > 0) {
        increments.adWatchDuration = metric.durationMs;
      }
      if (metric.monetizedSession) {
        increments.monetizedPlaybackSessions = 1;
      }
      break;
    case 'skipped':
      increments.totalAdImpressions = 1;
      increments.skippedAds = 1;
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
    { date: metric.date, platform: metric.platform, country: metric.country },
    {
      $inc: increments,
      $setOnInsert: {
        date: metric.date,
        platform: metric.platform,
        country: metric.country
      }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  await recordRegionalRewardDaily({
    country: countrySource.country || metric.country,
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
      rewarded: metric.rewarded,
      monetizedSession: metric.monetizedSession
    }
  });

  return saved;
}

module.exports = {
  upsertMonetizationDailyMetrics
};
