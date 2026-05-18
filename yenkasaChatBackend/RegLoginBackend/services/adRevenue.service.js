const AdMetricDaily = require('../models/adMetricDaily.model');
const User = require('../models/user.model');
const YkcPayout = require('../models/ykcPayout.model');
const {
  normalizeCountryLabel,
  recordRegionalRewardDaily
} = require('./regionalRewards.service');

const REWARD_POOL_RATIO = 0.25;

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function roundMetric(value) {
  return Number(Number(value || 0).toFixed(6));
}

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function assertMonth(month = currentMonth()) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    const err = new Error('month must use YYYY-MM format');
    err.statusCode = 400;
    throw err;
  }
  return month;
}

function monthBounds(month = currentMonth()) {
  const safeMonth = assertMonth(month);
  const [year, monthNumber] = safeMonth.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;

  return {
    month: safeMonth,
    startDate: `${safeMonth}-01`,
    endDateExclusive: `${nextMonth}-01`
  };
}

function normalizeDailyMetricInput(input) {
  const date = (input.date || '').toString().trim();
  const country = normalizeCountryLabel(input.country || 'Ghana') || 'Ghana';
  const platform = (input.platform || '').toString().trim().toLowerCase();
  const impressions = Number(input.impressions);
  const requests = Number(input.requests);
  const revenue = Number(input.revenue);

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

  if (![impressions, requests, revenue].every((value) => Number.isFinite(value) && value >= 0)) {
    const err = new Error('impressions, requests, and revenue must be non-negative numbers');
    err.statusCode = 400;
    throw err;
  }

  return {
    date,
    country,
    platform,
    impressions,
    requests,
    revenue
  };
}

async function upsertDailyAdMetrics(input) {
  const metric = normalizeDailyMetricInput(input);
  const ecpm = metric.impressions > 0 ? (metric.revenue / metric.impressions) * 1000 : 0;
  const fillRate = metric.requests > 0 ? metric.impressions / metric.requests : 0;

  const saved = await AdMetricDaily.findOneAndUpdate(
    { date: metric.date, platform: metric.platform },
    {
      $set: {
        date: metric.date,
        platform: metric.platform,
        impressions: metric.impressions,
        requests: metric.requests,
        revenue: metric.revenue,
        ecpm: roundMetric(ecpm),
        fillRate: roundMetric(fillRate)
      }
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  console.log('[AdMetrics] daily upsert', {
    date: saved.date,
    platform: saved.platform,
    impressions: saved.impressions,
    requests: saved.requests,
    revenue: saved.revenue,
    ecpm: saved.ecpm,
    fillRate: saved.fillRate
  });

  await recordRegionalRewardDaily({
    country: metric.country,
    platform: metric.platform,
    impressions: metric.impressions,
    requests: metric.requests,
    adRevenue: metric.revenue,
    metadata: {
      source: 'adRevenue.dailyUpsert',
      date: metric.date
    }
  });

  return saved;
}

async function aggregateMonthlyAdRevenue(month = currentMonth()) {
  const bounds = monthBounds(month);
  const [row] = await AdMetricDaily.aggregate([
    {
      $match: {
        date: { $gte: bounds.startDate, $lt: bounds.endDateExclusive }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$revenue' },
        totalImpressions: { $sum: '$impressions' },
        totalRequests: { $sum: '$requests' },
        daysTracked: { $sum: 1 }
      }
    }
  ]);

  const totalRevenue = roundMoney(row?.totalRevenue || 0);
  const totalImpressions = Number(row?.totalImpressions || 0);
  const totalRequests = Number(row?.totalRequests || 0);
  const ecpm = totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0;
  const fillRate = totalRequests > 0 ? totalImpressions / totalRequests : 0;
  const rewardPool = roundMoney(totalRevenue * REWARD_POOL_RATIO);

  const summary = {
    month: bounds.month,
    totalRevenue,
    totalImpressions,
    totalRequests,
    rewardPool,
    ecpm: roundMetric(ecpm),
    fillRate: roundMetric(fillRate),
    daysTracked: Number(row?.daysTracked || 0)
  };

  console.log('[AdMetrics] monthly summary', summary);
  return summary;
}

async function calculateAndStoreYkcPayouts({ month = currentMonth(), rewardPoolOverride } = {}) {
  const summary = await aggregateMonthlyAdRevenue(month);
  const rewardPool = Number.isFinite(Number(rewardPoolOverride))
    ? roundMoney(Number(rewardPoolOverride))
    : summary.rewardPool;

  if (rewardPool < 0) {
    const err = new Error('rewardPool must be a non-negative number');
    err.statusCode = 400;
    throw err;
  }

  const earners = await User.find({ ykcEarnedThisMonth: { $gt: 0 } })
    .select('username walletId ykcEarnedThisMonth')
    .lean();
  const totalEligibleYkc = earners.reduce((sum, user) => (
    sum + Number(user.ykcEarnedThisMonth || 0)
  ), 0);
  const ykcValue = totalEligibleYkc > 0 ? rewardPool / totalEligibleYkc : 0;

  const payouts = earners.map((user) => ({
    month: summary.month,
    userId: user._id,
    username: user.username || '',
    walletId: user.walletId || '',
    ykcEarnedThisMonth: Number(user.ykcEarnedThisMonth || 0),
    ykcValue: roundMetric(ykcValue),
    payoutAmount: roundMoney(Number(user.ykcEarnedThisMonth || 0) * ykcValue),
    rewardPool,
    totalEligibleYkc,
    totalRevenue: summary.totalRevenue,
    totalImpressions: summary.totalImpressions,
    status: 'calculated',
    calculatedAt: new Date()
  }));

  if (payouts.length > 0) {
    await YkcPayout.bulkWrite(payouts.map((payout) => ({
      updateOne: {
        filter: { month: payout.month, userId: payout.userId },
        update: { $set: payout },
        upsert: true
      }
    })));
  }

  console.log('[YKC Payout] calculated from ad revenue', {
    month: summary.month,
    totalRevenue: summary.totalRevenue,
    rewardPool,
    totalEligibleYkc,
    ykcValue: roundMetric(ykcValue),
    payoutCount: payouts.length
  });

  return {
    ...summary,
    rewardPool,
    totalEligibleYkc,
    ykcValue: roundMetric(ykcValue),
    payouts
  };
}

module.exports = {
  REWARD_POOL_RATIO,
  upsertDailyAdMetrics,
  aggregateMonthlyAdRevenue,
  calculateAndStoreYkcPayouts
};
