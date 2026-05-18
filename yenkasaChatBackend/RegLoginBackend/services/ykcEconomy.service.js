const CoinTransaction = require('../models/cointransaction.model');
const ActivityLog = require('../models/activityLog.model');
const mongoose = require('mongoose');
const {
  getCountryRewardConfig,
  resolveRewardCountry,
  recordRegionalRewardDaily,
  DEFAULT_COUNTRY
} = require('./regionalRewards.service');

const GO_LIVE_DATE = new Date('2026-05-05T00:00:00.000Z');
const MAX_DAILY_YKC = 500;
const REPEATED_VIEW_WINDOW_MS = 10 * 60 * 1000;

const REWARD_VALUES = {
  REWARD_POST_VIEW_1000: 8,
  REWARD_POST_VIEW_RECEIVED: 8,
  REWARD_WATCH_TIME_10_MIN: 10,
  REWARD_LONG_WATCH: 10,
  REWARD_SHORT_VIDEO_VIEW: 5,
  REWARD_AUDIO_VIEW: 5,
  REWARD_IMAGE_VIEW: 1,
  REWARD_TEXT_VIEW: 1,
  REWARD_POST_SINGLE_VIEW_RECEIVED: 1,
  REWARD_POST_LIKE_RECEIVED: 1,
  REWARD_POST_COMMENT_RECEIVED: 1,
  REWARD_POST: 20,
  REWARD_POST_APPROVED: 20,
  REWARD_COMMENT: 1,
  REWARD_REPLY: 1,
  REWARD_POST_LIKE: 1,
  REWARD_COMMENT_LIKE: 0.5,
  REWARD_DAILY_LOGIN: 5,
  REWARD_ACCOUNT_AGE: 1,
  REWARD_FOLLOW: 10,
  REWARD_FOLLOW_RECEIVED: 2,
  REWARD_CONVERSATION_STREAK: 5,
  REWARD_JOIN_COMMUNITY: 0,
  REWARD_CREATE_COMMUNITY: 8,
  REWARD_COMMUNITY_APPROVED: 8,
  REWARD_POST_REJECTED: 1
};

function isYkcLive(now = new Date()) {
  return now >= GO_LIVE_DATE;
}

function startOfDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function normalizeRewardAmount(type, requestedAmount, now = new Date()) {
  if (!isYkcLive(now)) return Number(requestedAmount);
  return Number(REWARD_VALUES[type] ?? requestedAmount);
}

function getRequestIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

function getDeviceId(req) {
  return (
    req.headers['x-device-id'] ||
    req.headers['x-yenkasa-device-id'] ||
    req.body?.deviceId ||
    req.query?.deviceId ||
    ''
  ).toString().trim();
}

async function sumDailyRewards(userId, now = new Date()) {
  const [row] = await CoinTransaction.aggregate([
    {
      $match: {
        toUserId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
        status: 'completed',
        type: /^REWARD_/,
        createdAt: { $gte: startOfDay(now) }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return Number(row?.total || 0);
}

async function getRewardGuard({ userId, type, amount, now = new Date(), country = null, dailyCap = null }) {
  const dailyEarned = await sumDailyRewards(userId, now);
  const effectiveCap = Number.isFinite(Number(dailyCap))
    ? Number(dailyCap)
    : getCountryRewardConfig(country).dailyYkcCap;

  if (dailyEarned + Number(amount) > effectiveCap) {
    return {
      allowed: false,
      reason: 'daily_cap',
      dailyEarned,
      remainingDailyYkc: Math.max(0, effectiveCap - dailyEarned),
      dailyCap: effectiveCap,
      country: country || DEFAULT_COUNTRY || 'Ghana'
    };
  }

  if (type === 'REWARD_COMMENT') {
    const commentsLastHour = await CoinTransaction.countDocuments({
      toUserId: userId,
      type: 'REWARD_COMMENT',
      status: 'completed',
      createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) }
    });
    if (commentsLastHour >= 50) {
      return { allowed: false, reason: 'comment_rate_limit', commentsLastHour };
    }
  }

  if (type === 'REWARD_POST_LIKE') {
    const likesToday = await CoinTransaction.countDocuments({
      toUserId: userId,
      type: 'REWARD_POST_LIKE',
      status: 'completed',
      createdAt: { $gte: startOfDay(now) }
    });
    if (likesToday >= 25) {
      return { allowed: false, reason: 'like_rate_limit', likesToday };
    }
  }

  if (type === 'REWARD_DAILY_LOGIN') {
    const loginRewardToday = await CoinTransaction.exists({
      toUserId: userId,
      type: 'REWARD_DAILY_LOGIN',
      status: 'completed',
      createdAt: { $gte: startOfDay(now) }
    });
    if (loginRewardToday) {
      return { allowed: false, reason: 'daily_login_already_awarded' };
    }
  }

  return { allowed: true, dailyEarned };
}

async function recordCountryRewardAnalytics(user, rewardAmount, opts = {}) {
  const countryContext = resolveRewardCountry(user);
  return recordRegionalRewardDaily({
    country: countryContext.country,
    rewardPayout: Number(rewardAmount || 0),
    rewardCount: Number(rewardAmount || 0) > 0 ? 1 : 0,
    verifiedCountry: user?.verifiedCountry || '',
    detectedCountry: user?.detectedCountry || '',
    countryConfidence: user?.countryConfidence || countryContext.confidence,
    metadata: {
      ...opts,
      countrySource: countryContext.source
    }
  });
}

async function logYkcActivity(payload) {
  console.log('[YKC Activity]', {
    userId: payload.userId?.toString(),
    action: payload.action,
    coinsAwarded: payload.coinsAwarded || 0,
    timestamp: payload.timestamp || new Date()
  });
  return ActivityLog.create(payload).catch((err) => {
    console.warn('[YKC Activity] log failed:', err.message);
  });
}

module.exports = {
  GO_LIVE_DATE,
  MAX_DAILY_YKC,
  REPEATED_VIEW_WINDOW_MS,
  REWARD_VALUES,
  isYkcLive,
  startOfDay,
  startOfMonth,
  normalizeRewardAmount,
  getRequestIp,
  getDeviceId,
  getRewardGuard,
  logYkcActivity,
  recordCountryRewardAnalytics,
  resolveRewardCountry,
  getCountryRewardConfig
};
