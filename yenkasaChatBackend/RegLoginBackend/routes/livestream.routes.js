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
  return `live:${streamId}`;
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
    activeStream.endedAt = new Date();
    activeStream.endReason = 'time_limit';
    activeStream.viewerCount = 0;
    await activeStream.save();
    liveAutoEndTimers.delete(streamId);
    global.io?.to(liveRoom(streamId)).emit('live_time_limit', {
      streamId,
      message: 'Your livestream session has ended. Time limit reached.'
    });
    global.io?.to(liveRoom(streamId)).emit('live_ended', {
      streamId,
      reason: 'time_limit',
      message: 'Your livestream session has ended. Time limit reached.'
    });
    global.io?.emit('live_removed', { streamId });
    logLiveEvent('auto_end', activeStream, { reason: 'time_limit' });
  }, delay);

  liveAutoEndTimers.set(streamId, timer);
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
      { $set: { isLive: false, endedAt: new Date(), viewerCount: 0 } }
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
      isLive: true,
      viewerCount: 0
    });

    global.io?.emit('live_started', { stream: serializeStream(stream) });
    scheduleAutoEnd(stream);
    logLiveEvent('start', stream, { rankLimitMinutes: permission.maxDurationMinutes });

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
    const limit = Math.min(Number(req.query.limit || 30), 50);
    const streams = await LiveStream.find({ isLive: true })
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

    const stream = await LiveStream.findOne({ _id: req.params.id, isLive: true });
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Livestream is no longer active.' });
    }

    let role = 'audience';
    if (req.body?.role === 'broadcaster' && stream.hostId.toString() === req.user._id.toString()) {
      const permission = canStartLivestream(req.user);
      if (!permission.allowed) {
        return res.status(403).json({
          success: false,
          message: 'Your account is not eligible to broadcast livestreams.'
        });
      }
      role = 'broadcaster';
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

    const stream = await LiveStream.findOne({ _id: req.params.id, isLive: true });
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Livestream is not active.' });
    }

    if (stream.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the host can end this livestream.' });
    }

    stream.isLive = false;
    stream.endedAt = new Date();
    stream.endReason = 'host_ended';
    stream.viewerCount = 0;
    await stream.save();
    clearTimeout(liveAutoEndTimers.get(stream._id.toString()));
    liveAutoEndTimers.delete(stream._id.toString());

    global.io?.to(liveRoom(stream._id)).emit('live_ended', { streamId: stream._id.toString(), reason: 'host_ended' });
    global.io?.emit('live_removed', { streamId: stream._id.toString() });
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

    const stream = await LiveStream.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewerCount: -1 } },
      { new: true }
    );
    if (stream && stream.viewerCount < 0) {
      stream.viewerCount = 0;
      await stream.save();
    }

    if (stream?.isLive) {
      global.io?.to(liveRoom(stream._id)).emit('live_viewer_count', {
        streamId: stream._id.toString(),
        viewerCount: stream.viewerCount
      });
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

    const stream = await LiveStream.findOne({ _id: streamId, isLive: true }).session(session);
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
    global.io?.to(liveRoom(streamId)).emit('live_gift', event);
    global.io?.to(liveRoom(streamId)).emit('live_reaction', {
      streamId,
      userId: req.user._id.toString(),
      reaction: gift.emoji,
      createdAt: new Date().toISOString()
    });

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
