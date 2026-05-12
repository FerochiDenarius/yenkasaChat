const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const auth = require('../middleware/auth');
const Comment = require('../models/comment.model');
const View = require('../models/view.model');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const LikeActivity = require('../models/likeActivity.model');
const Message = require('../models/message.model');
const AppVerification = require('../models/appverification.model');
const LiveDuel = require('../models/liveDuel.model');
const rewardService = require('../services/reward.service');
const { getConversationStreak } = require('../utils/conversationStreak');

const router = express.Router();

const WINDOWS = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  today: 'today',
};

const DUEL_DURATION_MS = 5 * 60 * 1000;
const MICRO_REWARD_INTERVAL_MS = 5 * 60 * 1000;
const DUEL_REWARD_AMOUNT = 12;
const MICRO_REWARD_COMMENT_AMOUNT = 5;
const MICRO_REWARD_VIEW_AMOUNT = 3;
const SNAPSHOT_TTL = 10 * 60 * 1000;
const previousRankSnapshots = new Map();
const activityCache = new Map();
const processedRewardIntervals = new Map();
const MASK_USERNAMES = false;

router.get('/metrics', auth, async (req, res) => {
  const currentUserId = String(req.user.id || '');
  const windowKey = String(req.query.window || '5m').toLowerCase();
  const normalizedWindow = windowKey in WINDOWS ? windowKey : '5m';
  const range = resolveWindow(normalizedWindow);
  const now = new Date();

  try {
    const rewardResult = await safeLiveMetric(
      'micro rewards',
      () => processMicroRewardsIfNeeded(now),
      { winners: [], rewardAmount: MICRO_REWARD_COMMENT_AMOUNT, processedAt: now.toISOString() }
    );
    const [commentsRanking, likesRanking, viewsRanking, connectorsRanking, ykcRanking, activityFeed, duel, conversationStreak] = await Promise.all([
      safeLiveMetric('comments ranking', () => buildRanking({
          model: Comment,
          match: { isActive: true, createdAt: range },
          groupField: '$userId',
          accumulator: { $sum: 1 },
          currentUserId,
          metricLabel: 'comments',
        }), buildEmptyRanking(currentUserId, 'comments')),
      safeLiveMetric('likes ranking', () => buildRanking({
          model: LikeActivity,
          match: { targetType: 'post', createdAt: range },
          groupField: '$actorUserId',
          accumulator: { $sum: 1 },
          currentUserId,
          metricLabel: 'post likes',
        }), buildEmptyRanking(currentUserId, 'post likes')),
      safeLiveMetric('views ranking', () => buildRanking({
          model: View,
          match: { viewedAt: range },
          groupField: '$userId',
          accumulator: { $sum: 1 },
          currentUserId,
          metricLabel: 'views',
        }), buildEmptyRanking(currentUserId, 'views')),
      safeLiveMetric('connectors ranking', () => buildRanking({
          model: Follow,
          match: { status: 'active', createdAt: range },
          groupField: '$follower',
          accumulator: { $sum: 1 },
          currentUserId,
          metricLabel: 'follows',
        }), buildEmptyRanking(currentUserId, 'follows')),
      safeLiveMetric('ykc ranking', () => buildRanking({
          model: CoinTransaction,
          match: {
            status: 'completed',
            amount: { $gt: 0 },
            createdAt: range,
            $or: [{ type: { $regex: '^REWARD_' } }, { type: 'BONUS' }],
          },
          groupField: '$toUserId',
          accumulator: { $sum: '$amount' },
          currentUserId,
          metricLabel: 'YKC',
        }), buildEmptyRanking(currentUserId, 'YKC')),
      safeLiveMetric('activity feed', () => buildActivityFeed(range, currentUserId), []),
      safeLiveMetric('active duel', () => getActiveDuelForUser(currentUserId, now), null),
      safeLiveMetric('conversation streak', () => buildConversationStreak(currentUserId), {
        days: 0,
        activeConnections: 0,
        message: ''
      }),
    ]);

    const sections = {
      comments: {
        title: 'Top Commenters',
        metricKey: 'comments',
        action: 'comment',
        leaders: commentsRanking.leaders,
        currentUser: commentsRanking.currentUser,
      },
      likes: {
        title: 'Top Post Likes',
        metricKey: 'likes',
        action: 'like',
        leaders: likesRanking.leaders,
        currentUser: likesRanking.currentUser,
      },
      views: {
        title: 'Most Views Given',
        metricKey: 'views',
        action: 'view',
        leaders: viewsRanking.leaders,
        currentUser: viewsRanking.currentUser,
      },
      follows: {
        title: 'Top Connectors',
        metricKey: 'follows',
        action: 'follow',
        leaders: connectorsRanking.leaders,
        currentUser: connectorsRanking.currentUser,
      },
      ykc: {
        title: 'Top YKC Earned',
        metricKey: 'ykc',
        action: 'like',
        leaders: ykcRanking.leaders,
        currentUser: ykcRanking.currentUser,
      },
    };

    const events = buildOvertakeEvents({
      windowKey: normalizedWindow,
      sections,
      currentUserId,
    });

    if (rewardResult.winners.some((winner) => winner.userId === currentUserId)) {
      rewardResult.winners
        .filter((winner) => winner.userId === currentUserId)
        .forEach((winner) => {
          events.unshift(`🎉 You earned +${winner.rewardAmount} YKC (${winner.metricLabel})`);
        });
    }

    res.json({
      window: normalizedWindow,
      topCommenters: sections.comments,
      topLikes: sections.likes,
      topViews: sections.views,
      topConnectors: sections.follows,
      topYKC: sections.ykc,
      activityFeed,
      events: events.slice(0, 8),
      duel,
      microReward: buildCurrentMicroReward(now, sections.comments, sections.views),
      activeEvent: getActiveLiveEvent(now),
      conversationStreak,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[LiveRoute] Failed to build live metrics:', error);
    res.json(buildSafeLiveMetricsResponse({ window: normalizedWindow, currentUserId, now }));
  }
});

router.post('/duel/create', auth, async (req, res) => {
  const currentUserId = String(req.user.id || '');
  const metricType = normalizeMetricType(req.body?.metricType || req.body?.metricKey || 'comment');

  if (!metricType) {
    return res.status(400).json({ error: 'Invalid duel metric' });
  }

  try {
    const existing = await findOpenDuelForUser(currentUserId);
    if (existing) {
      return res.status(409).json({ error: 'You already have an active duel', duel: await formatDuelForUser(existing, currentUserId, new Date()) });
    }

    const opponents = await findMatchedOpponents(currentUserId);
    if (!opponents.length) {
      return res.status(404).json({ error: 'No suitable duel opponent available right now.' });
    }

    for (const opponent of opponents) {
      const opponentId = String(opponent._id);
      const recentPairDuel = await LiveDuel.findOne({
        status: { $in: ['pending', 'active', 'completed'] },
        createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
        $or: [
          { userA: currentUserId, userB: opponentId },
          { userA: opponentId, userB: currentUserId },
        ],
      }).lean();

      if (recentPairDuel) continue;

      const duel = await LiveDuel.create({
        duelId: uuidv4(),
        userA: currentUserId,
        userB: opponentId,
        metricType,
        status: 'pending',
        userAScore: 0,
        userBScore: 0,
      });

      const reserved = await reserveOpenDuelForPair(duel, currentUserId, opponentId);
      if (!reserved) continue;

      const formatted = await formatDuelForUser(
        await LiveDuel.findById(duel._id).populate('userA', 'username profileImage role').populate('userB', 'username profileImage role'),
        currentUserId,
        new Date()
      );
      return res.json({
        message: 'Live duel created',
        duel: formatted,
      });
    }

    const active = await findOpenDuelForUser(currentUserId);
    if (active) {
      return res.status(409).json({
        error: 'You already have an active duel',
        duel: await formatDuelForUser(
          await LiveDuel.findById(active._id).populate('userA', 'username profileImage role').populate('userB', 'username profileImage role'),
          currentUserId,
          new Date()
        ),
      });
    }

    return res.status(409).json({ error: 'Everyone matched is already in a live battle. Try again shortly.' });
  } catch (error) {
    console.error('[LiveRoute] Failed to create duel:', error);
    return res.status(500).json({ error: 'Failed to create duel' });
  }
});

router.post('/duel/join', auth, async (req, res) => {
  const currentUserId = String(req.user.id || '');
  const duelId = String(req.body?.duelId || '');

  if (!duelId) {
    return res.status(400).json({ error: 'duelId is required' });
  }

  try {
    const duel = await LiveDuel.findOne({ duelId }).populate('userA', 'username profileImage').populate('userB', 'username profileImage');
    if (!duel) {
      return res.status(404).json({ error: 'Duel not found' });
    }

    if (String(duel.userB._id) !== currentUserId) {
      return res.status(403).json({ error: 'Only the invited opponent can join this duel' });
    }

    const existing = await findOpenDuelForUser(currentUserId, duel.duelId);
    if (existing) {
      return res.status(409).json({
        error: 'You are already in another live duel',
        duel: await formatDuelForUser(
          await LiveDuel.findById(existing._id).populate('userA', 'username profileImage role').populate('userB', 'username profileImage role'),
          currentUserId,
          new Date()
        ),
      });
    }

    if (duel.status !== 'pending') {
      return res.status(409).json({ error: 'This duel is no longer pending' });
    }

    const now = new Date();
    const [userACount, userBCount] = await Promise.all([
      getMetricCountForUser(metricTypeToRankingKey(duel.metricType), String(duel.userA._id), now, null),
      getMetricCountForUser(metricTypeToRankingKey(duel.metricType), String(duel.userB._id), now, null),
    ]);

    duel.startTime = now;
    duel.endTime = new Date(now.getTime() + DUEL_DURATION_MS);
    duel.userAStartMetric = userACount;
    duel.userBStartMetric = userBCount;
    duel.userAScore = 0;
    duel.userBScore = 0;
    duel.status = 'active';
    await duel.save();

    return res.json({
      message: 'Live duel accepted',
      duel: await formatDuelForUser(duel, currentUserId, now),
    });
  } catch (error) {
    console.error('[LiveRoute] Failed to join duel:', error);
    return res.status(500).json({ error: 'Failed to join duel' });
  }
});

router.get('/duel/active', auth, async (req, res) => {
  const currentUserId = String(req.user.id || '');
  try {
    const duel = await getActiveDuelForUser(currentUserId, new Date());
    return res.json({ duel });
  } catch (error) {
    console.error('[LiveRoute] Failed to fetch active duel:', error);
    return res.status(500).json({ error: 'Failed to fetch active duel' });
  }
});

router.post('/rewards/process', auth, async (req, res) => {
  try {
    const result = await processMicroRewardsIfNeeded(new Date(), true);
    res.json(result);
  } catch (error) {
    console.error('[LiveRoute] Failed to process live rewards:', error);
    res.status(500).json({ error: 'Failed to process live rewards' });
  }
});

router.get('/events', auth, async (_req, res) => {
  res.json({
    activeEvent: getActiveLiveEvent(new Date()),
  });
});

async function safeLiveMetric(label, work, fallback) {
  try {
    return await work();
  } catch (error) {
    console.warn(`[LiveRoute] ${label} unavailable:`, error.message);
    return fallback;
  }
}

function buildEmptyRanking(currentUserId, metricLabel) {
  return {
    leaders: [],
    currentUser: buildFallbackCurrentUser(currentUserId, metricLabel),
  };
}

function buildSafeLiveMetricsResponse({ window, currentUserId, now }) {
  const comments = buildEmptyRanking(currentUserId, 'comments');
  const likes = buildEmptyRanking(currentUserId, 'post likes');
  const views = buildEmptyRanking(currentUserId, 'views');
  const follows = buildEmptyRanking(currentUserId, 'follows');
  const ykc = buildEmptyRanking(currentUserId, 'YKC');

  return {
    window,
    topCommenters: {
      title: 'Top Commenters',
      metricKey: 'comments',
      action: 'comment',
      ...comments,
    },
    topLikes: {
      title: 'Top Post Likes',
      metricKey: 'likes',
      action: 'like',
      ...likes,
    },
    topViews: {
      title: 'Most Views Given',
      metricKey: 'views',
      action: 'view',
      ...views,
    },
    topConnectors: {
      title: 'Top Connectors',
      metricKey: 'follows',
      action: 'follow',
      ...follows,
    },
    topYKC: {
      title: 'Top YKC Earned',
      metricKey: 'ykc',
      action: 'like',
      ...ykc,
    },
    activityFeed: [],
    events: ['⚡ Live Arena is recovering. Rankings will update shortly.'],
    duel: null,
    microReward: buildCurrentMicroReward(now, comments, views),
    activeEvent: getActiveLiveEvent(now),
    conversationStreak: {
      days: 0,
      activeConnections: 0,
      message: '',
    },
    generatedAt: now.toISOString(),
  };
}

async function buildRanking({
  model,
  match,
  groupField,
  accumulator,
  currentUserId,
  metricLabel,
}) {
  const rows = await model.aggregate([
    { $match: match },
    {
      $group: {
        _id: groupField,
        count: accumulator,
      },
    },
    { $sort: { count: -1, _id: 1 } },
  ]);

  const rankedRows = rows
    .filter((row) => row && row._id && mongoose.Types.ObjectId.isValid(String(row._id)))
    .map((row, index) => ({
      userId: String(row._id),
      count: Number(row.count || 0),
      rank: index + 1,
    }));

  const topRows = rankedRows.slice(0, 3);
  const currentUserRow = rankedRows.find((row) => row.userId === currentUserId) || null;
  const userIds = [...new Set([...topRows.map((row) => row.userId), currentUserId].filter(Boolean))];
  const [users, titleMap] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select('username profileImage')
          .lean()
      : [],
    loadLiveTitles(userIds),
  ]);

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const leaderCount = topRows[0]?.count || 0;

  return {
    leaders: topRows.map((row, index) =>
      enrichLeaderboardRow({
        row,
        user: userMap.get(row.userId),
        currentUserId,
        leaderCount,
        metricLabel,
        higherRow: index > 0 ? topRows[index - 1] : null,
        liveTitle: titleMap.get(row.userId),
      })
    ),
    currentUser: currentUserRow
      ? enrichLeaderboardRow({
          row: currentUserRow,
          user: userMap.get(currentUserRow.userId),
          currentUserId,
          leaderCount,
          metricLabel,
          higherRow:
            currentUserRow.rank > 1
              ? rankedRows[currentUserRow.rank - 2] || null
              : null,
          liveTitle: titleMap.get(currentUserRow.userId),
        })
      : buildFallbackCurrentUser(currentUserId, metricLabel),
  };
}

function enrichLeaderboardRow({
  row,
  user,
  currentUserId,
  leaderCount,
  metricLabel,
  higherRow,
  liveTitle,
}) {
  const leaderGap = Math.max(0, leaderCount - Number(row.count || 0));
  const nextRankGap = higherRow ? Math.max(0, Number(higherRow.count || 0) - Number(row.count || 0)) : 0;
  const isCurrentUser = row.userId === currentUserId;

  let progressHint = leaderGap <= 0
    ? 'You are leading'
    : `+${leaderGap + 1} to win ${metricLabel}`;

  if (isCurrentUser && row.rank > 1 && nextRankGap <= 4) {
    progressHint = `You are #${row.rank} — +${nextRankGap + 1} to take #${row.rank - 1} 🔥`;
  } else if (isCurrentUser && row.rank > 1) {
    progressHint = `You are #${row.rank} — +${nextRankGap + 1} to move up`;
  }

  return {
    userId: row.userId,
    username: isCurrentUser ? 'You' : safeDisplayName(user?.username || 'Yenkasa user', row.userId),
    profileImage: user?.profileImage || '',
    count: Number(row.count || 0),
    rank: Number(row.rank || 0),
    isCurrentUser,
    progressHint,
    liveTitle: liveTitle?.title || '',
    titleType: liveTitle?.type || '',
  };
}

function buildFallbackCurrentUser(currentUserId, metricLabel) {
  return {
    userId: currentUserId,
    username: 'You',
    profileImage: '',
    count: 0,
    rank: 0,
    isCurrentUser: true,
    progressHint: `Start now to climb ${metricLabel}`,
    liveTitle: '',
    titleType: '',
  };
}

async function loadLiveTitles(userIds) {
  const validUserIds = [...new Set(userIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id))))];
  if (!validUserIds.length) return new Map();
  const wins = await LiveDuel.aggregate([
    {
      $match: {
        status: 'completed',
        winner: { $in: validUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    {
      $group: {
        _id: '$winner',
        wins: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    wins.map((row) => {
      const count = Number(row.wins || 0);
      if (count >= 5) return [String(row._id), { title: 'Live Beast', type: 'badge' }];
      if (count >= 2) return [String(row._id), { title: 'Arena Rising', type: 'badge' }];
      return [String(row._id), null];
    }).filter((entry) => entry[1])
  );
}

async function buildActivityFeed(range, currentUserId) {
  const cacheKey = `activity:${currentUserId}:${new Date(range.$gte).toISOString()}`;
  const cached = activityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3000) {
    return cached.data;
  }

  const [recentComments, recentLikes, recentViews, recentFollows, recentYkc, liveDuels] = await Promise.all([
    Comment.find({ isActive: true, createdAt: range })
      .populate('userId', 'username profileImage')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    LikeActivity.find({ targetType: 'post', createdAt: range })
      .populate('actorUserId', 'username profileImage')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    View.find({ viewedAt: range })
      .populate('userId', 'username profileImage')
      .sort({ viewedAt: -1 })
      .limit(4)
      .lean(),
    Follow.find({ status: 'active', createdAt: range })
      .populate('follower', 'username profileImage')
      .populate('following', 'username')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    CoinTransaction.find({
      status: 'completed',
      amount: { $gt: 0 },
      createdAt: range,
      $or: [{ type: { $regex: '^REWARD_' } }, { type: 'BONUS' }],
    })
      .populate('toUserId', 'username profileImage')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    LiveDuel.find({ status: { $in: ['pending', 'active'] } })
      .populate('userA', 'username profileImage')
      .populate('userB', 'username profileImage')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
  ]);

  const rawEvents = [
    ...liveDuels.map((duel) => buildDuelActivityEvent(duel, currentUserId)),
    ...recentComments.map((item) => ({
      id: `comment-${item._id}`,
      type: 'comment',
      createdAt: item.createdAt,
      userId: String(item.userId?._id || ''),
      profileImage: item.userId?.profileImage || '',
      text:
        String(item.userId?._id || '') === currentUserId
          ? '⚡ You pushed the comment rankings'
          : `🔥 ${safeDisplayName(item.userId?.username || 'Someone', item.userId?._id)} added a comment`,
    })),
    ...recentLikes.map((item) => ({
      id: `like-${item._id}`,
      type: 'like',
      createdAt: item.createdAt,
      userId: String(item.actorUserId?._id || ''),
      profileImage: item.actorUserId?.profileImage || '',
      text:
        String(item.actorUserId?._id || '') === currentUserId
          ? '💚 You pushed the post likes battle'
          : `💚 ${safeDisplayName(item.actorUserId?.username || 'Someone', item.actorUserId?._id)} liked a post`,
    })),
    ...recentViews.map((item) => ({
      id: `view-${item._id}`,
      type: 'view',
      createdAt: item.viewedAt || item.createdAt,
      userId: String(item.userId?._id || ''),
      profileImage: item.userId?.profileImage || '',
      text:
        String(item.userId?._id || '') === currentUserId
          ? '⚡ You just climbed in views'
          : `👀 ${safeDisplayName(item.userId?.username || 'Someone', item.userId?._id)} viewed a post`,
    })),
    ...recentFollows.map((item) => ({
      id: `follow-${item._id}`,
      type: 'follow',
      createdAt: item.createdAt,
      userId: String(item.follower?._id || ''),
      profileImage: item.follower?.profileImage || '',
      text:
        String(item.follower?._id || '') === currentUserId
          ? `🤝 You followed ${safeDisplayName(item.following?.username || 'a user', item.following?._id)}`
          : `🤝 ${safeDisplayName(item.follower?.username || 'Someone', item.follower?._id)} followed ${safeDisplayName(item.following?.username || 'a user', item.following?._id)}`,
    })),
    ...recentYkc.map((item) => ({
      id: `ykc-${item._id}`,
      type: 'ykc',
      createdAt: item.createdAt,
      userId: String(item.toUserId?._id || ''),
      profileImage: item.toUserId?.profileImage || '',
      text:
        String(item.toUserId?._id || '') === currentUserId
          ? `💰 You earned ${Number(item.amount || 0)} YKC`
          : `💰 ${safeDisplayName(item.toUserId?.username || 'Someone', item.toUserId?._id)} earned ${Number(item.amount || 0)} YKC`,
    })),
  ];

  const result = rawEvents
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10)
    .map((event) => ({
      ...event,
      isCurrentUser: event.userId === currentUserId,
    }));

  activityCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

function buildDuelActivityEvent(duel, currentUserId) {
  const userAId = String(duel.userA?._id || duel.userA || '');
  const userBId = String(duel.userB?._id || duel.userB || '');
  const userAName = safeDisplayName(duel.userA?.username || 'A challenger', userAId);
  const userBName = safeDisplayName(duel.userB?.username || 'a rival', userBId);
  const isCurrentUser = userAId === currentUserId || userBId === currentUserId;
  const otherName = userAId === currentUserId ? userBName : userAName;
  const action = duel.status === 'active' ? 'battling live' : 'matched for battle';

  return {
    id: `duel-${duel.duelId}`,
    type: 'duel',
    createdAt: duel.updatedAt || duel.createdAt,
    userId: isCurrentUser ? currentUserId : userAId,
    profileImage: isCurrentUser
      ? (userAId === currentUserId ? duel.userA?.profileImage : duel.userB?.profileImage) || ''
      : duel.userA?.profileImage || '',
    text: isCurrentUser
      ? `⚔️ You are ${action} with ${otherName}`
      : `⚔️ ${userAName} and ${userBName} are ${action}`,
    isCurrentUser,
  };
}

function buildOvertakeEvents({ windowKey, sections, currentUserId }) {
  cleanupSnapshots();
  const snapshotKey = `live:${windowKey}`;
  const previousEntry = previousRankSnapshots.get(snapshotKey);
  const previous = previousEntry?.data || {};
  const current = {};
  const events = [];

  for (const section of Object.values(sections)) {
    current[section.metricKey] = section.leaders.map((leader) => ({
      userId: leader.userId,
      username: leader.username,
      rank: leader.rank,
    }));

    const currentRanks = current[section.metricKey];
    const previousRanks = previous[section.metricKey] || [];
    const previousByUserId = new Map(previousRanks.map((row) => [row.userId, row]));
    const previousByRank = new Map(previousRanks.map((row) => [row.rank, row]));

    for (const row of currentRanks) {
      const previousRow = previousByUserId.get(row.userId);
      if (!previousRow || row.rank >= previousRow.rank) continue;

      if (row.userId === currentUserId) {
        events.push(`⚡ You moved to #${row.rank} in ${section.metricKey}`);
        continue;
      }

      const overtaken = previousByRank.get(row.rank);
      if (overtaken && overtaken.userId !== row.userId) {
        events.push(`🔥 ${row.username || 'Someone'} overtook ${overtaken.username || 'Someone'} in ${section.metricKey}`);
      } else {
        events.push(`🔥 ${row.username || 'Someone'} climbed to #${row.rank} in ${section.metricKey}`);
      }
    }
  }

  previousRankSnapshots.set(snapshotKey, {
    data: current,
    createdAt: Date.now(),
  });
  return events
    .filter(Boolean)
    .slice(0, 5);
}

async function getActiveDuelForUser(userId, now) {
  const duel = await LiveDuel.findOne({
    status: { $in: ['pending', 'active'] },
    $or: [{ userA: userId }, { userB: userId }],
  })
    .sort({ createdAt: -1 })
    .populate('userA', 'username profileImage role')
    .populate('userB', 'username profileImage role');

  if (!duel) return null;

  if (duel.status === 'active') {
    await refreshDuelScores(duel, now);
    if (duel.endTime && duel.endTime.getTime() <= now.getTime()) {
      await resolveDuel(duel);
    }
  }

  return formatDuelForUser(duel, userId, now);
}

async function refreshDuelScores(duel, now) {
  if (!duel.startTime) return duel;
  const metricKey = metricTypeToRankingKey(duel.metricType);
  const [userACurrent, userBCurrent] = await Promise.all([
    getMetricCountForUser(metricKey, String(duel.userA._id || duel.userA), duel.startTime, now),
    getMetricCountForUser(metricKey, String(duel.userB._id || duel.userB), duel.startTime, now),
  ]);

  duel.userAScore = Math.max(0, userACurrent - Number(duel.userAStartMetric || 0));
  duel.userBScore = Math.max(0, userBCurrent - Number(duel.userBStartMetric || 0));
  await duel.save();
  return duel;
}

async function resolveDuel(duel) {
  if (duel.status === 'completed') return duel;

  duel.status = 'completed';
  if (duel.userAScore > duel.userBScore) {
    duel.winner = duel.userA._id || duel.userA;
  } else if (duel.userBScore > duel.userAScore) {
    duel.winner = duel.userB._id || duel.userB;
  } else {
    duel.winner = null;
  }

  if (duel.winner && !duel.rewardGranted) {
    await rewardService.reward(String(duel.winner), DUEL_REWARD_AMOUNT, {
      type: 'BONUS',
      description: `Won a Yenkasa Live ${duel.metricType} duel`,
      activityId: `live-duel-${duel.duelId}`,
    });
    duel.rewardGranted = true;
  }

  await duel.save();
  return duel;
}

async function formatDuelForUser(duel, userId, now) {
  const isUserA = String(duel.userA?._id || duel.userA) === String(userId);
  const me = isUserA ? duel.userA : duel.userB;
  const opponent = isUserA ? duel.userB : duel.userA;

  return {
    duelId: duel.duelId,
    metricType: duel.metricType,
    status: duel.status,
    youUsername: isUserA ? 'You' : duel.userB?.username || 'You',
    opponentId: String(opponent?._id || ''),
    opponentName: opponent?.username || 'Arena challenger',
    opponentImage: opponent?.profileImage || '',
    yourScore: isUserA ? Number(duel.userAScore || 0) : Number(duel.userBScore || 0),
    opponentScore: isUserA ? Number(duel.userBScore || 0) : Number(duel.userAScore || 0),
    startTime: duel.startTime,
    endTime: duel.endTime,
    winner: duel.winner ? String(duel.winner) : null,
    isCreator: isUserA,
    canJoin: duel.status === 'pending' && !isUserA,
    prizeYkc: DUEL_REWARD_AMOUNT,
    timeLeftSeconds: duel.endTime ? Math.max(0, Math.floor((duel.endTime.getTime() - now.getTime()) / 1000)) : 0,
  };
}

async function findMatchedOpponents(userId, limit = 8) {
  const verification = await AppVerification.findOne({ userId }).lean();
  const user = await User.findById(userId).select('role username').lean();
  const score = getActivityScore(verification?.metrics);
  const role = String(user?.role || '').toLowerCase();

  const candidates = await AppVerification.find({ userId: { $ne: userId } })
    .populate('userId', 'username profileImage role')
    .lean();

  const scoredCandidates = candidates
    .map((candidate) => {
      const candidateUser = candidate.userId;
      if (!candidateUser?._id) return null;
      return {
        user: candidateUser,
        roleMatch: String(candidateUser.role || '').toLowerCase() === role,
        score: getActivityScore(candidate.metrics),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.roleMatch !== right.roleMatch) {
        return left.roleMatch ? -1 : 1;
      }
      return Math.abs(left.score - score) - Math.abs(right.score - score);
    });

  const opponents = [];
  for (const candidate of scoredCandidates) {
    const candidateId = String(candidate.user._id);
    const hasOpenDuel = await findOpenDuelForUser(candidateId);
    if (hasOpenDuel) continue;
    if (candidateId === userId) continue;
    opponents.push(candidate.user);
    if (opponents.length >= limit) break;
  }

  return opponents;
}

function getActivityScore(metrics = {}) {
  return Number(metrics.totalCommentsMade || 0) * 3 +
    Number(metrics.totalViewsMade || 0) * 2 +
    Number(metrics.postsLiked || 0) * 2 +
    Number(metrics.totalFollowing || 0);
}

async function reserveOpenDuelForPair(duel, userAId, userBId) {
  const openDuels = await LiveDuel.find({
    status: { $in: ['pending', 'active'] },
    $or: [
      { userA: userAId },
      { userB: userAId },
      { userA: userBId },
      { userB: userBId },
    ],
  }).sort({ createdAt: 1, _id: 1 });

  const winner = openDuels[0];
  const reserved = String(winner?._id || '') === String(duel._id);
  if (!reserved) {
    await LiveDuel.updateOne({ _id: duel._id, status: 'pending' }, { $set: { status: 'declined' } });
    return false;
  }

  const duplicateIds = openDuels
    .slice(1)
    .filter((item) => item.status === 'pending')
    .map((item) => item._id);
  if (duplicateIds.length) {
    await LiveDuel.updateMany({ _id: { $in: duplicateIds } }, { $set: { status: 'declined' } });
  }

  return true;
}

async function findOpenDuelForUser(userId, excludeDuelId = null) {
  const query = {
    status: { $in: ['pending', 'active'] },
    $or: [{ userA: userId }, { userB: userId }],
  };
  if (excludeDuelId) {
    query.duelId = { $ne: excludeDuelId };
  }
  return LiveDuel.findOne(query).sort({ createdAt: -1 }).lean();
}

function normalizeMetricType(value) {
  const normalized = String(value || '').toLowerCase();
  if (['comment', 'comments'].includes(normalized)) return 'comment';
  if (['view', 'views'].includes(normalized)) return 'view';
  if (['like', 'likes'].includes(normalized)) return 'like';
  return null;
}

function metricTypeToRankingKey(metricType) {
  switch (metricType) {
    case 'comment':
      return 'comments';
    case 'view':
      return 'views';
    case 'like':
      return 'likes';
    default:
      return 'comments';
  }
}

async function getMetricCountForUser(metricKey, userId, startTime, endTime = null) {
  const range = buildBoundedRange(startTime, endTime);
  switch (metricKey) {
    case 'comments':
      return Comment.countDocuments({ userId, isActive: true, createdAt: range });
    case 'views':
      return View.countDocuments({ userId, viewedAt: range });
    case 'likes':
      return LikeActivity.countDocuments({ actorUserId: userId, targetType: 'post', createdAt: range });
    default:
      return 0;
  }
}

function buildBoundedRange(startTime, endTime = null) {
  const range = {};
  if (startTime) range.$gte = startTime;
  if (endTime) range.$lte = endTime;
  return range;
}

async function processMicroRewardsIfNeeded(now, force = false) {
  const completedPeriodEnd = Math.floor(now.getTime() / MICRO_REWARD_INTERVAL_MS) * MICRO_REWARD_INTERVAL_MS;
  const completedPeriodStart = completedPeriodEnd - MICRO_REWARD_INTERVAL_MS;
  const rewardKey = `${completedPeriodStart}`;

  if (!force && processedRewardIntervals.has(rewardKey)) {
    return processedRewardIntervals.get(rewardKey);
  }

  const periodRange = {
    $gte: new Date(completedPeriodStart),
    $lt: new Date(completedPeriodEnd),
  };

  const [topCommenter, topViewer] = await Promise.all([
    aggregateTopUser(Comment, { isActive: true, createdAt: periodRange }, '$userId'),
    aggregateTopUser(View, { viewedAt: periodRange }, '$userId'),
  ]);

  const winners = [];
  if (topCommenter?.userId) {
    await rewardService.reward(topCommenter.userId, MICRO_REWARD_COMMENT_AMOUNT, {
      type: 'BONUS',
      description: 'Top Commenter in Yenkasa Live',
      activityId: `live-reward-comment-${rewardKey}`,
    });
    winners.push({
      userId: topCommenter.userId,
      username: topCommenter.username,
      metricType: 'comment',
      metricLabel: 'Top Commenter',
      rewardAmount: MICRO_REWARD_COMMENT_AMOUNT,
    });
  }

  if (topViewer?.userId) {
    await rewardService.reward(topViewer.userId, MICRO_REWARD_VIEW_AMOUNT, {
      type: 'BONUS',
      description: 'Top Viewer in Yenkasa Live',
      activityId: `live-reward-view-${rewardKey}`,
    });
    winners.push({
      userId: topViewer.userId,
      username: topViewer.username,
      metricType: 'view',
      metricLabel: 'Top Viewer',
      rewardAmount: MICRO_REWARD_VIEW_AMOUNT,
    });
  }

  const result = {
    winners,
    rewardAmount: MICRO_REWARD_COMMENT_AMOUNT,
    processedAt: now.toISOString(),
  };
  processedRewardIntervals.set(rewardKey, result);
  return result;
}

async function aggregateTopUser(model, match, groupField) {
  const rows = await model.aggregate([
    { $match: match },
    { $group: { _id: groupField, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 1 },
  ]);

  const row = rows[0];
  if (!row?._id) return null;
  const user = await User.findById(row._id).select('username').lean();
  return {
    userId: String(row._id),
    username: user?.username || 'Yenkasa user',
    count: Number(row.count || 0),
  };
}

function buildCurrentMicroReward(now, topCommenters, topViews) {
  const currentPeriodStart = Math.floor(now.getTime() / MICRO_REWARD_INTERVAL_MS) * MICRO_REWARD_INTERVAL_MS;
  const currentPeriodEnd = currentPeriodStart + MICRO_REWARD_INTERVAL_MS;
  const commentLeader = topCommenters.leaders[0] || null;
  const viewLeader = topViews.leaders[0] || null;

  return {
    rewardAmount: MICRO_REWARD_COMMENT_AMOUNT,
    nextRewardAt: new Date(currentPeriodEnd).toISOString(),
    topCommenter: commentLeader ? {
      username: commentLeader.username,
      count: commentLeader.count,
      isCurrentUser: commentLeader.isCurrentUser,
    } : null,
    topViewer: viewLeader ? {
      username: viewLeader.username,
      count: viewLeader.count,
      isCurrentUser: viewLeader.isCurrentUser,
    } : null,
  };
}

function getActiveLiveEvent(now) {
  const hour = now.getHours();
  if (hour >= 20 && hour < 21) {
    return {
      name: '🔥 Night Arena',
      duration: '1 hour',
      bonusMultiplier: 2,
    };
  }
  if (hour >= 12 && hour < 13) {
    return {
      name: '⚡ Lunch Rush',
      duration: '1 hour',
      bonusMultiplier: 1.5,
    };
  }
  return null;
}

async function buildConversationStreak(userId) {
  const streak = await getConversationStreak(userId, true);
  return {
    days: streak.current,
    activeConnections: streak.activeConnections || 0,
    message:
      streak.current > 0
        ? `🔥 Conversation Streak: ${streak.current} day${streak.current > 1 ? 's' : ''}`
        : '',
  };
}

function resolveWindow(windowKey) {
  const now = Date.now();
  if (windowKey === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { $gte: start };
  }

  const duration = WINDOWS[windowKey] || WINDOWS['5m'];
  return { $gte: new Date(now - Number(duration)) };
}

function cleanupSnapshots() {
  const now = Date.now();
  for (const [key, value] of previousRankSnapshots.entries()) {
    if (!value?.createdAt || now - value.createdAt > SNAPSHOT_TTL) {
      previousRankSnapshots.delete(key);
    }
  }
}

function safeDisplayName(username, userId) {
  if (!MASK_USERNAMES) return username || 'Someone';
  const suffix = String(userId || Math.floor(Math.random() * 9000) + 1000).slice(-4);
  return `User #${suffix}`;
}

module.exports = router;
