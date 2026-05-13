const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const auth = require('../middleware/auth');
const LiveStream = require('../models/LiveStream');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const { canStartLivestream } = require('../config/livestreamPermissions');
const { generateRtcToken } = require('../utils/agoraTokenGenerator');

const liveAutoEndTimers = new Map();
const liveStartupTimers = new Map();
const LIVE_STARTUP_GRACE_MS = Number(process.env.LIVESTREAM_STARTUP_GRACE_MS || 90000);

const LIVE_GIFTS = {
  love: { label: 'Love', emoji: '❤️', amount: 5 },
  fire: { label: 'Fire', emoji: '🔥', amount: 10 },
  crown: { label: 'Crown', emoji: '👑', amount: 50 },
  rocket: { label: 'Rocket', emoji: '🚀', amount: 100 }
};

function serializeStream(stream) {
  return {
    _id: stream._id.toString(),
    hostId: stream.hostId?.toString?.() || stream.hostId,
    hostUsername: stream.hostUsername,
    hostAvatar: stream.hostAvatar || '',
    title: stream.title,
    thumbnail: stream.thumbnail || '',
    community: stream.community || '',
    agoraChannel: stream.agoraChannel,
    isLive: Boolean(stream.isLive),
    lifecycleStatus: stream.lifecycleStatus || (stream.isLive ? 'live' : 'ended'),
    hostConnected: Boolean(stream.hostConnected),
    hostJoinedAt: stream.hostJoinedAt || null,
    hostLastSeenAt: stream.hostLastSeenAt || null,
    startupExpiresAt: stream.startupExpiresAt || null,
    viewerCount: stream.viewerCount || 0,
    peakViewerCount: stream.peakViewerCount || 0,
    hostRole: stream.hostRole || '',
    maxDurationMinutes: stream.maxDurationMinutes ?? null,
    scheduledEndAt: stream.scheduledEndAt || null,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt
  };
}

function liveRoom(streamId) {
  return `livestream_${streamId}`;
}

function legacyLiveRoom(streamId) {
  return `live:${streamId}`;
}

function emitToLiveRoom(streamId, eventName, payload) {
  global.io?.to(liveRoom(streamId)).to(legacyLiveRoom(streamId)).emit(eventName, payload);
}

function emitLiveDirectory(eventName, payload) {
  global.io?.emit(eventName, payload);
}

function logLiveEvent(event, stream, extra = {}) {
  console.log('[YenkasaLiveStream]', {
    event,
    streamId: stream?._id?.toString?.(),
    userId: stream?.hostId?.toString?.(),
    username: stream?.hostUsername,
    role: stream?.hostRole,
    title: stream?.title,
    durationSeconds: stream?.startedAt ? Math.max(0, Math.round((Date.now() - new Date(stream.startedAt).getTime()) / 1000)) : 0,
    startTime: stream?.startedAt,
    endTime: stream?.endedAt,
    viewerPeak: stream?.peakViewerCount || 0,
    ...extra
  });
}

function scheduleAutoEnd(stream) {
  const streamId = stream._id.toString();
  if (liveAutoEndTimers.has(streamId)) {
    clearTimeout(liveAutoEndTimers.get(streamId));
    liveAutoEndTimers.delete(streamId);
  }
  if (!stream.scheduledEndAt) return;

  const delay = new Date(stream.scheduledEndAt).getTime() - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(async () => {
    const activeStream = await LiveStream.findOne({ _id: streamId, isLive: true });
    if (!activeStream) return;
    activeStream.isLive = false;
    activeStream.lifecycleStatus = 'ended';
    activeStream.hostConnected = false;
    activeStream.hostSocketId = '';
    activeStream.endedAt = new Date();
    activeStream.endReason = 'time_limit';
    activeStream.viewerCount = 0;
    await activeStream.save();
    liveAutoEndTimers.delete(streamId);
    const timeLimitEvent = {
      streamId,
      message: 'Your livestream session has ended. Time limit reached.'
    };
    emitToLiveRoom(streamId, 'livestream_time_limit', timeLimitEvent);
    emitToLiveRoom(streamId, 'live_time_limit', timeLimitEvent);
    const endedEvent = {
      streamId,
      reason: 'time_limit',
      message: 'Your livestream session has ended. Time limit reached.'
    };
    emitToLiveRoom(streamId, 'livestream_ended', endedEvent);
    emitToLiveRoom(streamId, 'live_ended', endedEvent);
    emitLiveDirectory('livestream_removed', { streamId, reason: 'time_limit' });
    emitLiveDirectory('live_removed', { streamId, reason: 'time_limit' });
    logLiveEvent('auto_end', activeStream, { reason: 'time_limit' });
  }, delay);

  liveAutoEndTimers.set(streamId, timer);
}

function clearStartupTimer(streamId) {
  const normalizedStreamId = streamId?.toString();
  if (!normalizedStreamId) return;
  if (liveStartupTimers.has(normalizedStreamId)) {
    clearTimeout(liveStartupTimers.get(normalizedStreamId));
    liveStartupTimers.delete(normalizedStreamId);
  }
}

async function failStartingStream(streamId, reason = 'startup_timeout') {
  if (!mongoose.Types.ObjectId.isValid(streamId)) return null;

  const stream = await LiveStream.findOneAndUpdate(
    {
      _id: streamId,
      lifecycleStatus: 'starting',
      hostConnected: false
    },
    {
      $set: {
        isLive: false,
        lifecycleStatus: 'failed',
        endedAt: new Date(),
        endReason: reason,
        viewerCount: 0,
        hostSocketId: '',
        startupExpiresAt: null
      }
    },
    { new: true }
  );

  if (!stream) return null;
  clearStartupTimer(streamId);
  const removedEvent = { streamId: stream._id.toString(), reason };
  emitLiveDirectory('livestream_removed', removedEvent);
  emitLiveDirectory('live_removed', removedEvent);
  logLiveEvent('startup_failed', stream, { reason });
  return stream;
}

function scheduleStartupExpiry(stream) {
  const streamId = stream._id.toString();
  clearStartupTimer(streamId);
  if (!stream.startupExpiresAt) return;

  const delay = new Date(stream.startupExpiresAt).getTime() - Date.now();
  if (delay <= 0) {
    failStartingStream(streamId).catch((err) => {
      console.error('Livestream startup expiry failed:', err.message);
    });
    return;
  }

  const timer = setTimeout(() => {
    failStartingStream(streamId).catch((err) => {
      console.error('Livestream startup expiry failed:', err.message);
    });
  }, delay);
  liveStartupTimers.set(streamId, timer);
}

async function cleanupExpiredStartingStreams() {
  const now = new Date();
  const staleStreams = await LiveStream.find({
    lifecycleStatus: 'starting',
    hostConnected: false,
    startupExpiresAt: { $lte: now }
  }).select('_id').lean();

  await Promise.allSettled(
    staleStreams.map((stream) => failStartingStream(stream._id.toString()))
  );
}

router.post('/create', auth, async (req, res) => {
  try {
    const permission = canStartLivestream(req.user);
    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not eligible to start livestreams.'
      });
    }

    const title = req.body?.title?.toString?.().trim();
    if (!title) {
      return res.status(400).json({ success: false, message: 'Live title is required.' });
    }

    const agoraChannel = `yenkasa_live_${req.user._id}_${Date.now()}`;
    const agora = generateRtcToken({
      channelName: agoraChannel,
      userId: req.user._id,
      role: 'broadcaster'
    });

    await LiveStream.updateMany(
      { hostId: req.user._id, isLive: true },
      {
        $set: {
          isLive: false,
          lifecycleStatus: 'ended',
          hostConnected: false,
          hostSocketId: '',
          endedAt: new Date(),
          endReason: 'superseded',
          viewerCount: 0
        }
      }
    );

    const stream = await LiveStream.create({
      hostId: req.user._id,
      hostUsername: req.user.username,
      hostAvatar: req.user.profileImage || '',
      title,
      thumbnail: req.body?.thumbnail || req.user.profileImage || '',
      community: req.body?.community || '',
      agoraChannel,
      hostRole: permission.role || 'senior_developer',
      maxDurationMinutes: permission.maxDurationMinutes,
      scheduledEndAt: permission.maxDurationMinutes
        ? new Date(Date.now() + permission.maxDurationMinutes * 60 * 1000)
        : null,
      isLive: false,
      lifecycleStatus: 'starting',
      hostConnected: false,
      startupExpiresAt: new Date(Date.now() + LIVE_STARTUP_GRACE_MS),
      viewerCount: 0
    });

    scheduleStartupExpiry(stream);
    scheduleAutoEnd(stream);
    logLiveEvent('create_starting', stream, { rankLimitMinutes: permission.maxDurationMinutes });

    return res.status(201).json({
      success: true,
      stream: serializeStream(stream),
      agora
    });
  } catch (err) {
    console.error('Create livestream failed:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to create livestream.'
    });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    await cleanupExpiredStartingStreams();
    const limit = Math.min(Number(req.query.limit || 30), 50);
    const streams = await LiveStream.find({
      isLive: true,
      lifecycleStatus: 'live',
      hostConnected: true
    })
      .sort({ viewerCount: -1, startedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      streams: streams.map(serializeStream)
    });
  } catch (err) {
    console.error('Active livestreams failed:', err);
    return res.status(500).json({ success: false, message: 'Failed to load livestreams.' });
  }
});

router.post('/join/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid livestream id.' });
    }

    let role = 'audience';
    const requestedBroadcaster = req.body?.role === 'broadcaster';
    const stream = await LiveStream.findOne({
      _id: req.params.id,
      ...(requestedBroadcaster
        ? { lifecycleStatus: { $in: ['starting', 'live'] } }
        : { isLive: true, lifecycleStatus: 'live', hostConnected: true })
    });
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Livestream is no longer active.' });
    }

    if (requestedBroadcaster && stream.hostId.toString() === req.user._id.toString()) {
      const permission = canStartLivestream(req.user);
      if (!permission.allowed) {
        return res.status(403).json({
          success: false,
          message: 'Your account is not eligible to broadcast livestreams.'
        });
      }
      role = 'broadcaster';
    } else if (requestedBroadcaster) {
      return res.status(403).json({ success: false, message: 'Only the host can broadcast this livestream.' });
    }

    const agora = generateRtcToken({
      channelName: stream.agoraChannel,
      userId: req.user._id,
      role
    });

    return res.json({
      success: true,
      stream: serializeStream(stream),
      agora
    });
  } catch (err) {
    console.error('Join livestream failed:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to join livestream.'
    });
  }
});

router.post('/end/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid livestream id.' });
    }

    const stream = await LiveStream.findOne({
      _id: req.params.id,
      lifecycleStatus: { $in: ['starting', 'live'] }
    });
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Livestream is not active.' });
    }

    if (stream.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the host can end this livestream.' });
    }

    stream.isLive = false;
    stream.lifecycleStatus = 'ended';
    stream.hostConnected = false;
    stream.hostSocketId = '';
    stream.startupExpiresAt = null;
    stream.endedAt = new Date();
    stream.endReason = 'host_ended';
    stream.viewerCount = 0;
    await stream.save();
    clearTimeout(liveAutoEndTimers.get(stream._id.toString()));
    liveAutoEndTimers.delete(stream._id.toString());
    clearStartupTimer(stream._id);

    const endedEvent = { streamId: stream._id.toString(), reason: 'host_ended' };
    emitToLiveRoom(stream._id, 'livestream_ended', endedEvent);
    emitToLiveRoom(stream._id, 'live_ended', endedEvent);
    emitLiveDirectory('livestream_removed', { streamId: stream._id.toString(), reason: 'host_ended' });
    emitLiveDirectory('live_removed', { streamId: stream._id.toString(), reason: 'host_ended' });
    logLiveEvent('end', stream, { reason: 'host_ended' });

    return res.json({ success: true, stream: serializeStream(stream) });
  } catch (err) {
    console.error('End livestream failed:', err);
    return res.status(500).json({ success: false, message: 'Failed to end livestream.' });
  }
});

router.post('/leave/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid livestream id.' });
    }

    const stream = await LiveStream.findOneAndUpdate(
      {
        _id: req.params.id,
        isLive: true,
        lifecycleStatus: 'live'
      },
      { $inc: { viewerCount: -1 } },
      { new: true }
    );
    if (stream && stream.viewerCount < 0) {
      stream.viewerCount = 0;
      await stream.save();
    }

    if (stream?.isLive) {
      const countEvent = {
        streamId: stream._id.toString(),
        viewerCount: stream.viewerCount
      };
      emitToLiveRoom(stream._id, 'livestream_viewer_count', countEvent);
      emitToLiveRoom(stream._id, 'live_viewer_count', countEvent);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Leave livestream failed:', err);
    return res.status(500).json({ success: false, message: 'Failed to leave livestream.' });
  }
});

router.post('/gift', auth, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const streamId = req.body?.streamId?.toString();
    const giftKey = req.body?.giftKey?.toString?.().trim().toLowerCase();
    const gift = LIVE_GIFTS[giftKey];

    if (!mongoose.Types.ObjectId.isValid(streamId) || !gift) {
      return res.status(400).json({ success: false, message: 'Invalid livestream gift request.' });
    }

    const stream = await LiveStream.findOne({
      _id: streamId,
      isLive: true,
      lifecycleStatus: 'live',
      hostConnected: true
    }).session(session);
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Livestream is no longer active.' });
    }
    if (stream.hostId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot gift your own livestream.' });
    }

    let sender;
    let host;
    let tx;

    await session.withTransaction(async () => {
      sender = await User.findById(req.user._id).session(session);
      host = await User.findById(stream.hostId).session(session);
      if (!sender || !host) throw new Error('Gift participants not found.');

      const senderBefore = Number(sender.ykcBalance ?? sender.coinsBalance ?? 0);
      if (senderBefore < gift.amount) {
        const error = new Error('Insufficient YKC balance.');
        error.status = 400;
        throw error;
      }
      const hostBefore = Number(host.ykcBalance ?? host.coinsBalance ?? 0);
      const senderAfter = senderBefore - gift.amount;
      const hostAfter = hostBefore + gift.amount;

      sender.ykcBalance = senderAfter;
      sender.coinsBalance = senderAfter;
      host.ykcBalance = hostAfter;
      host.coinsBalance = hostAfter;
      await Promise.all([sender.save({ session }), host.save({ session })]);

      tx = await CoinTransaction.create([{
        fromUserId: sender._id,
        toUserId: host._id,
        fromUsername: sender.username || '',
        toUsername: host.username || '',
        fromWalletId: sender.walletId || '',
        toWalletId: host.walletId || '',
        amount: gift.amount,
        type: 'LIVE_GIFT',
        description: `${sender.username} sent ${gift.label} to ${stream.hostUsername}'s live`,
        activityId: `live:${stream._id}`,
        transactionId: `LIVE-${stream._id}-${sender._id}-${Date.now()}`,
        status: 'completed',
        fromUserBalanceBefore: senderBefore,
        fromUserBalanceAfter: senderAfter,
        toUserBalanceBefore: hostBefore,
        toUserBalanceAfter: hostAfter
      }], { session });
    });

    const event = {
      streamId,
      giftKey,
      giftLabel: gift.label,
      emoji: gift.emoji,
      amount: gift.amount,
      senderId: req.user._id.toString(),
      senderUsername: req.user.username,
      hostId: stream.hostId.toString(),
      transactionId: tx?.[0]?.transactionId
    };
    emitToLiveRoom(streamId, 'livestream_gift', event);
    emitToLiveRoom(streamId, 'live_gift', event);
    const reactionEvent = {
      streamId,
      userId: req.user._id.toString(),
      username: req.user.username,
      reaction: gift.emoji,
      type: gift.emoji,
      createdAt: new Date().toISOString()
    };
    emitToLiveRoom(streamId, 'livestream_reaction', reactionEvent);
    emitToLiveRoom(streamId, 'live_reaction', reactionEvent);

    return res.json({
      success: true,
      gift: event,
      balance: Number(sender?.ykcBalance ?? sender?.coinsBalance ?? 0)
    });
  } catch (err) {
    console.error('Livestream gift failed:', err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to send live gift.'
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;
