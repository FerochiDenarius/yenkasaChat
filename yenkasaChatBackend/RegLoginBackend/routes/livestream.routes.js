const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const auth = require('../middleware/auth');
const LiveStream = require('../models/LiveStream');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const { canStartLivestream } = require('../config/livestreamPermissions');
const { agoraUidFromUserId, generateRtcToken } = require('../utils/agoraTokenGenerator');
const { publishYmeEvent } = require('../src/yme/services/eventPublisher.service');
const {
  LIVESTREAM_EVENT_TYPES,
  emitLivestreamOperationalEvent,
  getLivestreamMetrics,
  getTopStreams,
} = require('../src/services/livestream/operationalEvents.service');

const liveAutoEndTimers = new Map();
const liveStartupTimers = new Map();
const LIVE_STARTUP_GRACE_MS = Number(process.env.LIVESTREAM_STARTUP_GRACE_MS || 90000);

const LIVE_GIFTS = {
  love: { label: 'Love', emoji: '❤️', amount: 5 },
  fire: { label: 'Fire', emoji: '🔥', amount: 10 },
  crown: { label: 'Crown', emoji: '👑', amount: 50 },
  rocket: { label: 'Rocket', emoji: '🚀', amount: 100 },
  diamond: { label: 'Diamond', emoji: '💎', amount: 500 },
  galaxy: { label: 'Galaxy', emoji: '🌌', amount: 1000 }
};

function resolveYkcBalance(user) {
  const ykcBalance = Number(user?.ykcBalance || 0);
  const coinsBalance = Number(user?.coinsBalance || 0);
  return Math.max(ykcBalance, coinsBalance);
}

function serializeLiveGuests(guests = []) {
  return (guests || []).map((guest) => {
    let agoraUid = Number(guest.agoraUid || 0);
    if ((!Number.isInteger(agoraUid) || agoraUid <= 0) && guest.userId) {
      try {
        agoraUid = agoraUidFromUserId(guest.userId);
      } catch (err) {
        agoraUid = 0;
      }
    }

    return {
      userId: guest.userId?.toString?.() || guest.userId || '',
      username: guest.username || '',
      avatar: guest.avatar || '',
      agoraUid,
      isMuted: Boolean(guest.isMuted),
      isVideoStopped: Boolean(guest.isVideoStopped),
      joinedAt: guest.joinedAt || null
    };
  }).filter((guest) => guest.userId && guest.agoraUid > 0);
}

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
    likeCount: stream.likeCount || 0,
    guests: serializeLiveGuests(stream.guests),
    hostRole: stream.hostRole || '',
    maxDurationMinutes: stream.maxDurationMinutes ?? null,
    scheduledEndAt: stream.scheduledEndAt || null,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt
  };
}

function liveRoom(streamId) {
  return `stream:${streamId}`;
}

function legacyLiveRoom(streamId) {
  return `livestream_${streamId}`;
}

function deprecatedLiveRoom(streamId) {
  return `live:${streamId}`;
}

function emitToLiveRoom(streamId, eventName, payload, extraRooms = []) {
  if (typeof global.emitToLiveRoomForStream === 'function') {
    global.emitToLiveRoomForStream(streamId, eventName, payload, extraRooms);
    return;
  }
  const hostRooms = (extraRooms || []).filter(Boolean);
  let target = global.io?.to(liveRoom(streamId)).to(legacyLiveRoom(streamId)).to(deprecatedLiveRoom(streamId));
  hostRooms.forEach((room) => {
    target = target?.to(room);
  });
  target?.emit(eventName, payload);
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

function liveUserContext(user) {
  return {
    userId: user?._id?.toString?.() || user?.id?.toString?.(),
    username: user?.username,
    role: user?.roleName || user?.staffRole || user?.accessRole || user?.role?.role || user?.role?.name || '',
    roleName: user?.roleName || '',
    staffRole: user?.staffRole || '',
    accessRole: user?.accessRole || '',
    permissionRole: user?.role?.role || user?.role?.name || '',
    verified: Boolean(user?.verified),
    hasVerifiedBanner: Boolean(user?.hasVerifiedBanner),
    verificationPhase: user?.verificationPhase || ''
  };
}

function liveApiError(res, status, code, message, logContext = {}) {
  console.warn('[YenkasaLiveStream][reject]', {
    status,
    code,
    message,
    ...logContext
  });
  return res.status(status).json({
    success: false,
    code,
    message
  });
}

function logLiveToken(event, user, stream, agora, extra = {}) {
  const expectedUid = agoraUidFromUserId(user?._id || user?.id);
  console.log('[YenkasaLiveStream][token]', {
    event,
    ...liveUserContext(user),
    streamId: stream?._id?.toString?.(),
    channelName: stream?.agoraChannel,
    uid: agora?.uid,
    expectedUid,
    uidMatchesUser: agora?.uid === expectedUid,
    tokenRole: agora?.role,
    tokenExpiresAt: agora?.expiresAt,
    tokenExpiresIn: agora?.expiresIn,
    ...extra
  });
}

function emitLiveRouteOperationalEvent(eventType, userId, stream, metadata = {}) {
  const task = emitLivestreamOperationalEvent(
    {
      eventType,
      streamId: stream?._id?.toString?.() || metadata.streamId || '',
      userId: userId?.toString?.() || '',
      hostId: stream?.hostId?.toString?.() || metadata.hostId || '',
      timestamp: metadata.createdAt || new Date().toISOString(),
      metadata: {
        title: stream?.title || '',
        community: stream?.community || '',
        viewerCount: stream?.viewerCount || 0,
        peakViewerCount: stream?.peakViewerCount || 0,
        routeEventSource: 'livestream.routes',
        ...metadata,
      },
    },
    {
      platform: 'http',
      sessionId: metadata.sessionId || '',
    },
  );

  return task.catch((error) => {
    console.warn('[YenkasaLiveStream][route_operational_event_failed]', {
      eventType,
      streamId: stream?._id?.toString?.() || metadata.streamId || '',
      userId: userId?.toString?.() || '',
      message: error.message,
    });
    return null;
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
    emitToLiveRoom(streamId, 'live_time_limit', timeLimitEvent);
    const endedEvent = {
      streamId,
      reason: 'time_limit',
      message: 'Your livestream session has ended. Time limit reached.'
    };
    emitToLiveRoom(streamId, 'live_ended', endedEvent);
    emitLiveDirectory('live_removed', { streamId, reason: 'time_limit' });
    global.clearLiveParticipantsForStream?.(streamId);
    emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_ENDED, activeStream.hostId, activeStream, {
      reason: 'time_limit',
      message: endedEvent.message,
    });
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
  emitLiveDirectory('live_removed', removedEvent);
  global.clearLiveParticipantsForStream?.(stream._id.toString());
  emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_ENDED, stream.hostId, stream, {
    reason,
  });
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
      return liveApiError(res, 403, permission.code || 'STREAM_PERMISSION_DENIED', permission.reason, {
        action: 'create',
        ...liveUserContext(req.user)
      });
    }

    const title = req.body?.title?.toString?.().trim();
    if (!title) {
      return liveApiError(res, 400, 'CHANNEL_INVALID', 'Please enter a title before starting your livestream.', {
        action: 'create',
        ...liveUserContext(req.user)
      });
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
    logLiveToken('create', req.user, stream, agora, { joinResult: 'token_generated' });

    return res.status(201).json({
      success: true,
      stream: serializeStream(stream),
      agora
    });
  } catch (err) {
    console.error('Create livestream failed:', {
      code: err.code || 'LIVE_CREATE_FAILED',
      message: err.message,
      ...liveUserContext(req.user)
    });
    return res.status(err.status || 500).json({
      success: false,
      code: err.code || 'BACKEND_AUTH_FAILED',
      message: err.code === 'AGORA_CONFIG_MISSING' || err.code === 'AGORA_UID_INVALID'
        ? 'Live video is temporarily unavailable. Please try again later.'
        : (err.message || 'We could not start your livestream. Please try again.')
    });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    await cleanupExpiredStartingStreams();
    const limit = Math.min(Number(req.query.limit || 30), 50);
    const community = req.query.community?.toString();

    const query = {
      isLive: true,
      lifecycleStatus: 'live',
      hostConnected: true
    };

    if (community && community !== 'global' && community !== 'all') {
      query.community = community;
    }

    const streams = await LiveStream.find(query)
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

router.get('/top-streams', auth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 50);
  return res.json({
    success: true,
    streams: getTopStreams(limit),
  });
});

router.get('/:id/metrics', auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid livestream id.' });
  }

  return res.json({
    success: true,
    metrics: getLivestreamMetrics(req.params.id),
  });
});

router.get('/:id/creator-intelligence', auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid livestream id.' });
  }

  const stream = await LiveStream.findById(req.params.id).select('hostId community viewerCount peakViewerCount').lean();
  if (!stream) {
    return res.status(404).json({ success: false, message: 'Livestream not found.' });
  }
  if (stream.hostId?.toString?.() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the host can view creator intelligence.' });
  }

  const metrics = getLivestreamMetrics(req.params.id);
  return res.json({
    success: true,
    creatorIntelligence: {
      peakViewers: Math.max(metrics.peakViewers, stream.peakViewerCount || 0),
      viewerRetention: metrics.retentionRate,
      engagementRate: metrics.totalViewers
        ? Number((metrics.engagementCount / metrics.totalViewers).toFixed(4))
        : 0,
      giftRevenue: metrics.giftRevenue,
      topAudienceCommunities: stream.community ? [{ community: stream.community, viewers: metrics.totalViewers }] : [],
      returningViewers: metrics.retentionRate,
      metrics,
    },
  });
});

router.post('/join/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return liveApiError(res, 400, 'CHANNEL_INVALID', 'This livestream link is invalid.', {
        action: 'join',
        streamId: req.params.id,
        ...liveUserContext(req.user)
      });
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
      return liveApiError(res, 404, 'CHANNEL_INVALID', 'This livestream has ended or is no longer available.', {
        action: 'join',
        requestedBroadcaster,
        streamId: req.params.id,
        ...liveUserContext(req.user)
      });
    }

    const isHostBroadcaster = requestedBroadcaster && stream.hostId.toString() === req.user._id.toString();
    const isApprovedGuestBroadcaster = requestedBroadcaster && (stream.guests || []).some(
      (guest) => guest.userId?.toString?.() === req.user._id.toString()
    );

    if (isHostBroadcaster) {
      const permission = canStartLivestream(req.user);
      if (!permission.allowed) {
        return liveApiError(res, 403, permission.code || 'STREAM_PERMISSION_DENIED', permission.reason, {
          action: 'join_broadcaster',
          streamId: stream._id.toString(),
          channelName: stream.agoraChannel,
          ...liveUserContext(req.user)
        });
      }
      role = 'broadcaster';
    } else if (isApprovedGuestBroadcaster) {
      role = 'broadcaster';
    } else if (requestedBroadcaster) {
      return liveApiError(res, 403, 'STREAM_PERMISSION_DENIED', 'Only the host or an approved guest can broadcast this livestream.', {
        action: 'join_broadcaster',
        streamId: stream._id.toString(),
        hostId: stream.hostId?.toString?.(),
        ...liveUserContext(req.user)
      });
    }

    const agora = generateRtcToken({
      channelName: stream.agoraChannel,
      userId: req.user._id,
      role
    });
    logLiveToken('join', req.user, stream, agora, { joinRole: role, joinResult: 'token_generated' });
    emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_JOINED, req.user._id, stream, {
      liveRole: role,
      agoraUid: agora.uid,
      tokenRole: agora.role,
    });

    return res.json({
      success: true,
      stream: serializeStream(stream),
      agora
    });
  } catch (err) {
    console.error('Join livestream failed:', {
      code: err.code || 'LIVE_JOIN_FAILED',
      message: err.message,
      streamId: req.params.id,
      ...liveUserContext(req.user)
    });
    return res.status(err.status || 500).json({
      success: false,
      code: err.code || 'BACKEND_AUTH_FAILED',
      message: err.code === 'AGORA_CONFIG_MISSING' || err.code === 'AGORA_UID_INVALID'
        ? 'Live video is temporarily unavailable. Please try again later.'
        : (err.message || 'We could not join this livestream. Please try again.')
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
    emitToLiveRoom(stream._id, 'live_ended', endedEvent);
    emitLiveDirectory('live_removed', { streamId: stream._id.toString(), reason: 'host_ended' });
    global.clearLiveParticipantsForStream?.(stream._id.toString());
    emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_ENDED, req.user._id, stream, {
      reason: 'host_ended',
    });
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
      emitToLiveRoom(stream._id, 'live_viewer_count', countEvent);
      emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_LEFT, req.user._id, stream, {
        viewerCount: stream.viewerCount,
        concurrentViewers: stream.viewerCount,
      });
      const durationMs = Math.max(0, Number(req.body?.durationMs || req.body?.watchTimeMs || 0));
      if (durationMs > 0) {
        emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION, req.user._id, stream, {
          durationMs,
          watchTimeMs: durationMs,
        });
      }
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

      const senderBefore = resolveYkcBalance(sender);
      if (senderBefore < gift.amount) {
        const error = new Error('Insufficient YKC balance.');
        error.status = 400;
        throw error;
      }
      const hostBefore = resolveYkcBalance(host);
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
        type: 'TRANSFER',
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
    const fallbackRooms = [stream.hostId.toString(), `user:${stream.hostId.toString()}`];
    emitToLiveRoom(streamId, 'live_gift', event, fallbackRooms);
    emitToLiveRoom(streamId, 'new_gift', event, fallbackRooms);
    emitToLiveRoom(streamId, 'gift_animation', event, fallbackRooms);
    const reactionEvent = {
      streamId,
      userId: req.user._id.toString(),
      username: req.user.username,
      reaction: gift.emoji,
      type: gift.emoji,
      createdAt: new Date().toISOString()
    };
    emitToLiveRoom(streamId, 'live_reaction', reactionEvent, fallbackRooms);
    emitToLiveRoom(streamId, 'new_like', reactionEvent, fallbackRooms);

    emitLiveRouteOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_GIFT, req.user._id, stream, {
      giftKey,
      giftLabel: gift.label,
      emoji: gift.emoji,
      amount: gift.amount,
      transactionId: tx?.[0]?.transactionId || '',
      hostId: stream.hostId.toString(),
      senderId: req.user._id.toString(),
      senderUsername: req.user.username,
    });

    publishYmeEvent({
      userId: req.user._id.toString(),
      sourceApp: 'live_arena',
      eventType: 'gift_sent',
      relatedUserId: stream.hostId.toString(),
      contentId: streamId,
      postId: streamId,
      payload: {
        giftKey,
        giftLabel: gift.label,
        emoji: gift.emoji,
        amount: gift.amount,
        transactionId: tx?.[0]?.transactionId || '',
      },
    });
    publishYmeEvent({
      userId: req.user._id.toString(),
      sourceApp: 'live_arena',
      eventType: 'wallet_transfer',
      relatedUserId: stream.hostId.toString(),
      contentId: streamId,
      postId: streamId,
      payload: {
        transferType: 'live_gift',
        amount: gift.amount,
        transactionId: tx?.[0]?.transactionId || '',
        giftKey,
      },
    });

    return res.json({
      success: true,
      gift: event,
      balance: resolveYkcBalance(sender),
      ykcBalance: resolveYkcBalance(sender),
      coinsBalance: resolveYkcBalance(sender)
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
