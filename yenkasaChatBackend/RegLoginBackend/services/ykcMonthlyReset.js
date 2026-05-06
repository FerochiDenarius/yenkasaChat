const cron = require('node-cron');
const User = require('../models/user.model');
const MonthlyYkcSnapshot = require('../models/monthlyYkcSnapshot.model');
const { startOfMonth } = require('./ykcEconomy.service');

function previousMonthKey(now = new Date()) {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function runMonthlyYkcReset(now = new Date()) {
  const monthKey = previousMonthKey(now);
  const resetDate = startOfMonth(now);
  const users = await User.find({}).select('_id coinsBalance ykcBalance ykcEarnedThisMonth totalQualifiedViews totalWatchTime totalMonetizableOpportunities').lean();

  if (users.length) {
    await MonthlyYkcSnapshot.bulkWrite(users.map((user) => ({
      updateOne: {
        filter: { userId: user._id, month: monthKey },
        update: {
          $set: {
            ykcEarnedThisMonth: Number(user.ykcEarnedThisMonth || 0),
            ykcBalance: Number(user.ykcBalance ?? user.coinsBalance ?? 0),
            totalQualifiedViews: Number(user.totalQualifiedViews || 0),
            totalWatchTime: Number(user.totalWatchTime || 0),
            totalMonetizableOpportunities: Number(user.totalMonetizableOpportunities || 0)
          }
        },
        upsert: true
      }
    })));
  }

  await User.updateMany({}, {
    $set: {
      ykcEarnedThisMonth: 0,
      ykcLastReset: resetDate
    }
  });

  console.log('[YKC Monthly Reset] completed', {
    month: monthKey,
    users: users.length,
    resetDate
  });
}

cron.schedule('0 0 1 * *', () => {
  runMonthlyYkcReset().catch((err) => {
    console.error('[YKC Monthly Reset] failed:', err.message);
  });
}, { timezone: 'Africa/Accra' });

module.exports = { runMonthlyYkcReset };
