const User = require('../models/user.model');
const View = require('../models/view.model');
const ActivityLog = require('../models/activityLog.model');
const MonthlyEconomyStat = require('../models/monthlyEconomyStat.model');
const {
  REWARD_POOL_RATIO,
  aggregateMonthlyAdRevenue
} = require('./adRevenue.service');

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

function monthDateBounds(month = currentMonth()) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    const err = new Error('month must use YYYY-MM format');
    err.statusCode = 400;
    throw err;
  }
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    month,
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1))
  };
}

async function calculateMonthlyRevenue(month = currentMonth()) {
  return aggregateMonthlyAdRevenue(month);
}

function calculateRewardPool(totalRevenue) {
  return roundMoney(Number(totalRevenue || 0) * REWARD_POOL_RATIO);
}

function calculateYkcValue(rewardPool, totalEligibleYkc) {
  const eligible = Number(totalEligibleYkc || 0);
  return eligible > 0 ? roundMetric(Number(rewardPool || 0) / eligible) : 0;
}

async function calculateMonthlyEconomyStats(month = currentMonth()) {
  const revenue = await calculateMonthlyRevenue(month);
  const bounds = monthDateBounds(month);
  const [viewStats] = await View.aggregate([
    {
      $match: {
        viewedAt: { $gte: bounds.start, $lt: bounds.end }
      }
    },
    {
      $group: {
        _id: null,
        totalQualifiedViews: { $sum: { $cond: ['$qualifiedView', 1, 0] } },
        totalMonetizableOpportunities: { $sum: { $cond: ['$monetizableOpportunity', 1, 0] } },
        totalWatchTime: { $sum: '$watchDuration' }
      }
    }
  ]);
  const [eligibleStats] = await User.aggregate([
    {
      $group: {
        _id: null,
        totalEligibleYkc: { $sum: '$ykcEarnedThisMonth' }
      }
    }
  ]);

  const rewardPool = calculateRewardPool(revenue.totalRevenue);
  const totalEligibleYkc = Number(eligibleStats?.totalEligibleYkc || 0);
  const ykcValue = calculateYkcValue(rewardPool, totalEligibleYkc);

  return {
    month: revenue.month,
    totalRevenue: revenue.totalRevenue,
    rewardPool,
    totalEligibleYkc,
    ykcValue,
    totalQualifiedViews: Number(viewStats?.totalQualifiedViews || 0),
    totalWatchTime: Number(viewStats?.totalWatchTime || 0),
    totalMonetizableOpportunities: Number(viewStats?.totalMonetizableOpportunities || 0),
    totalImpressions: revenue.totalImpressions,
    totalRequests: revenue.totalRequests,
    ecpm: revenue.ecpm,
    fillRate: revenue.fillRate,
    calculatedAt: new Date()
  };
}

async function storeMonthlyEconomySnapshot(month = currentMonth()) {
  const stats = await calculateMonthlyEconomyStats(month);
  const saved = await MonthlyEconomyStat.findOneAndUpdate(
    { month: stats.month },
    { $set: stats },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  console.log('[YKC Economy] monthly snapshot stored', {
    month: saved.month,
    rewardPool: saved.rewardPool,
    totalEligibleYkc: saved.totalEligibleYkc,
    ykcValue: saved.ykcValue,
    totalQualifiedViews: saved.totalQualifiedViews,
    totalMonetizableOpportunities: saved.totalMonetizableOpportunities
  });

  return saved;
}

async function getTopCreators({ month = currentMonth(), limit = 25 } = {}) {
  const stats = await storeMonthlyEconomySnapshot(month);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const users = await User.find({
    $or: [
      { totalMonetizableOpportunities: { $gt: 0 } },
      { totalQualifiedViews: { $gt: 0 } },
      { ykcEarnedThisMonth: { $gt: 0 } }
    ]
  })
    .select('username profileImage walletId ykcEarnedThisMonth totalQualifiedViews totalWatchTime totalMonetizableOpportunities')
    .sort({
      totalMonetizableOpportunities: -1,
      totalWatchTime: -1,
      ykcEarnedThisMonth: -1
    })
    .limit(safeLimit)
    .lean();

  return {
    month: stats.month,
    summary: stats,
    creators: users.map((user) => {
      const eligibleYkc = Number(user.ykcEarnedThisMonth || 0);
      return {
        userId: user._id,
        username: user.username || '',
        profileImage: user.profileImage || '',
        walletId: user.walletId || '',
        ykcEarnedThisMonth: eligibleYkc,
        totalQualifiedViews: Number(user.totalQualifiedViews || 0),
        totalWatchTime: Number(user.totalWatchTime || 0),
        estimatedMonetizableOpportunities: Number(user.totalMonetizableOpportunities || 0),
        estimatedPayout: roundMoney(eligibleYkc * Number(stats.ykcValue || 0))
      };
    })
  };
}

async function calculateCreatorContribution({ month = currentMonth(), limit = 25 } = {}) {
  return getTopCreators({ month, limit });
}

async function getFraudAlerts({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const suspiciousLogs = await ActivityLog.find({ suspicious: true })
    .select('userId postId action watchDuration qualifiedView monetizableOpportunity ipAddress deviceId metadata timestamp')
    .sort({ timestamp: -1 })
    .limit(safeLimit)
    .populate('userId', 'username profileImage walletId')
    .lean();
  const duplicatePatterns = await ActivityLog.aggregate([
    {
      $match: {
        action: 'POST_VIEW',
        suspicious: true
      }
    },
    {
      $group: {
        _id: {
          userId: '$userId',
          deviceId: '$deviceId',
          ipAddress: '$ipAddress'
        },
        count: { $sum: 1 },
        lastSeen: { $max: '$timestamp' }
      }
    },
    { $match: { count: { $gte: 3 } } },
    { $sort: { count: -1, lastSeen: -1 } },
    { $limit: safeLimit }
  ]);

  console.warn('[YKC Economy] fraud alerts queried', {
    suspiciousLogCount: suspiciousLogs.length,
    duplicatePatternCount: duplicatePatterns.length
  });

  return {
    suspiciousLogs,
    duplicatePatterns
  };
}

module.exports = {
  calculateMonthlyRevenue,
  calculateRewardPool,
  calculateYkcValue,
  calculateCreatorContribution,
  calculateMonthlyEconomyStats,
  storeMonthlyEconomySnapshot,
  getTopCreators,
  getFraudAlerts
};
