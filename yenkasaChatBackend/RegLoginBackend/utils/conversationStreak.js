const Message = require('../models/message.model');
const User = require('../models/user.model');
const rewardService = require('../services/reward.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_HOURS_AFTER_MIDNIGHT = 3;
const MIN_MESSAGE_SPAN_MS = 30 * 1000;

function safeTimezone(timezone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch (err) {
    return 'UTC';
  }
}

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const hour = Number(parts.hour === '24' ? 0 : parts.hour);
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
  };
}

function addDays(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

function storedDateKey(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
}

function storedDateFromKey(ymd) {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function zonedStartOfDayUtc(ymd, timezone) {
  const [year, month, day] = ymd.split('-').map(Number);
  let lo = Date.UTC(year, month - 1, day) - 36 * 60 * 60 * 1000;
  let hi = Date.UTC(year, month - 1, day) + 36 * 60 * 60 * 1000;

  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (localParts(new Date(mid), timezone).ymd < ymd) lo = mid + 1;
    else hi = mid;
  }

  return new Date(hi);
}

function zonedDayBounds(ymd, timezone) {
  return {
    start: zonedStartOfDayUtc(ymd, timezone),
    end: zonedStartOfDayUtc(addDays(ymd, 1), timezone),
  };
}

async function calculateActiveConnections(userId, options = {}) {
  const userIdString = String(userId);
  const end = options.end || new Date();
  const start = options.start || new Date(end.getTime() - DAY_MS);

  const roomIds = await Message.distinct('roomId', {
    senderId: userIdString,
    timestamp: { $gte: start, $lt: end },
  });

  if (!roomIds.length) return 0;

  const rows = await Message.aggregate([
    {
      $match: {
        roomId: { $in: roomIds },
        timestamp: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: '$roomId',
        totalMessages: { $sum: 1 },
        senders: { $addToSet: '$senderId' },
        firstMessageAt: { $min: '$timestamp' },
        lastMessageAt: { $max: '$timestamp' },
      },
    },
    {
      $project: {
        totalMessages: 1,
        partners: { $setDifference: ['$senders', [userIdString]] },
        spanMs: { $subtract: ['$lastMessageAt', '$firstMessageAt'] },
        hasCurrentUser: { $in: [userIdString, '$senders'] },
      },
    },
    {
      $match: {
        hasCurrentUser: true,
        totalMessages: { $gte: 3 },
        partners: { $ne: [] },
        spanMs: { $gte: MIN_MESSAGE_SPAN_MS },
      },
    },
    { $unwind: '$partners' },
    { $group: { _id: '$partners' } },
  ]);

  return rows.length;
}

async function updateConversationStreak(userId) {
  const user = await User.findById(userId);
  if (!user) return { current: 0, longest: 0, activeConnections: 0 };

  const timezone = safeTimezone(user.timezone || 'UTC');
  const nowParts = localParts(new Date(), timezone);
  const targetDateKey = nowParts.hour < GRACE_HOURS_AFTER_MIDNIGHT
    ? addDays(nowParts.ymd, -1)
    : nowParts.ymd;

  const streak = user.conversationStreak || {};
  if (storedDateKey(streak.lastActiveDate) === targetDateKey) {
    return {
      current: streak.current || 0,
      longest: streak.longest || 0,
      activeConnections: 0,
    };
  }

  const bounds = zonedDayBounds(targetDateKey, timezone);
  const activeConnections = await calculateActiveConnections(user._id, bounds);
  const previousDateKey = storedDateKey(streak.lastActiveDate);
  const yesterdayKey = addDays(targetDateKey, -1);

  let current = streak.current || 0;
  let rewardTx = null;
  if (activeConnections > 0) {
    current = previousDateKey === yesterdayKey ? current + 1 : 1;
    streak.lastActiveDate = storedDateFromKey(targetDateKey);
    rewardTx = await rewardService.reward(user._id, 5, {
      type: 'REWARD_CONVERSATION_STREAK',
      description: `Earned 5 YKC for keeping a ${current}-day conversation streak`,
      activityId: `conversation_streak_${user._id}_${targetDateKey}`
    });
  } else if (previousDateKey !== targetDateKey && previousDateKey !== yesterdayKey) {
    current = 0;
  }

  streak.current = current;
  streak.longest = Math.max(streak.longest || 0, current);
  user.conversationStreak = streak;
  await user.save();

  return {
    current: streak.current,
    longest: streak.longest,
    activeConnections,
    rewardAmount: rewardTx?.amount || 0,
    newBalance: rewardTx?.toUserBalanceAfter ?? null,
  };
}

async function getConversationStreak(userId, shouldUpdate = true) {
  if (shouldUpdate) return updateConversationStreak(userId);

  const user = await User.findById(userId).select('conversationStreak').lean();
  return {
    current: user?.conversationStreak?.current || 0,
    longest: user?.conversationStreak?.longest || 0,
    activeConnections: 0,
  };
}

module.exports = {
  calculateActiveConnections,
  updateConversationStreak,
  getConversationStreak,
};
