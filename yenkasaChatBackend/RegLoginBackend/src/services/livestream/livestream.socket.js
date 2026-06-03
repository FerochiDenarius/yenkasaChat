const livestreamService = require('./livestream.service');
const {
  LIVESTREAM_EVENT_TYPES,
  emitLivestreamOperationalEvent,
} = require('./operationalEvents.service');
const {
  queueLivestreamStartNotifications,
} = require('../../../services/livestreamStartNotification.service');

function registerLivestreamEvents(io, socket, { mongoose, User, LiveStream }) {
  socket.data.liveJoinTimes = socket.data.liveJoinTimes || new Map();

  function emitLiveOperationalEvent(eventType, actorUserId, payload = {}) {
    const userId = String(actorUserId || socket.data.userId || payload.userId || '').trim();
    if (!userId) return;

    const task = (async () => {
      let streamContext = {};
      const streamId = payload.streamId?.toString?.() || '';
      if (streamId && mongoose.Types.ObjectId.isValid(streamId) && !payload.hostId) {
        streamContext = await LiveStream.findById(streamId)
          .select('hostId title community viewerCount peakViewerCount')
          .lean() || {};
      }

      return emitLivestreamOperationalEvent(
        {
          eventType,
          streamId,
          userId,
          hostId: payload.hostId || streamContext.hostId || payload.relatedUserId || payload.targetUserId || userId,
          timestamp: payload.createdAt || new Date().toISOString(),
          metadata: {
            ...payload,
            title: payload.title || streamContext.title || '',
            community: payload.community || streamContext.community || '',
            viewerCount: payload.viewerCount ?? streamContext.viewerCount ?? 0,
            peakViewerCount: payload.peakViewerCount ?? streamContext.peakViewerCount ?? 0,
            socketEventSource: 'livestream.socket',
          },
        },
        {
          platform: 'socket',
          sessionId: socket.id,
        },
      );
    })();

    return task.catch((error) => {
      console.warn('[YenkasaLiveStream][operational_event_failed]', {
        eventType,
        userId,
        streamId: payload.streamId || '',
        message: error.message,
      });
      return null;
    });
  }

  async function resolveLiveActor(payload = {}) {
    const userId = (socket.data.userId || payload?.userId)?.toString();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return {
        userId: userId || '',
        username: payload?.username?.toString?.().trim() || 'Viewer',
        avatar: payload?.avatar?.toString?.().trim() || '',
      };
    }

    const user = await User.findById(userId).select('username profileImage avatar').lean();

    return {
      userId,
      username: user?.username || payload?.username?.toString?.().trim() || 'Viewer',
      avatar: user?.profileImage || user?.avatar || payload?.avatar?.toString?.().trim() || '',
    };
  }

  async function updateLiveViewerCount(streamId) {
    if (!mongoose.Types.ObjectId.isValid(streamId)) return null;
    const roomCount = livestreamService.getLiveRoomMemberCount(streamId);
    const stream = await LiveStream.findOneAndUpdate(
      {
        _id: streamId,
        isLive: true,
        lifecycleStatus: 'live',
        hostConnected: true,
      },
      { $set: { viewerCount: roomCount } },
      { new: true },
    );
    if (!stream) return null;
    if (stream.viewerCount < 0) {
      stream.viewerCount = 0;
      await stream.save();
    }
    if (stream.viewerCount > (stream.peakViewerCount || 0)) {
      stream.peakViewerCount = stream.viewerCount;
      await stream.save();
    }
    const payload = {
      streamId,
      viewerCount: stream.viewerCount,
    };
    livestreamService.emitToLiveRoom(streamId, 'live_viewer_count', payload);
    emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_PEAK_VIEWERS, stream.hostId?.toString?.(), {
      streamId,
      hostId: stream.hostId?.toString?.(),
      viewerCount: stream.viewerCount,
      peakViewerCount: stream.peakViewerCount || stream.viewerCount,
      concurrentViewers: stream.viewerCount,
      peakViewers: stream.peakViewerCount || stream.viewerCount,
    });
    return stream;
  }

  async function resolveLiveStreamContext(streamId) {
    if (!streamId || !mongoose.Types.ObjectId.isValid(streamId)) return null;
    return LiveStream.findById(streamId)
      .select('hostId title community isLive lifecycleStatus hostConnected viewerCount peakViewerCount')
      .lean();
  }

  function hostFallbackRooms(stream) {
    const hostId = stream?.hostId?.toString?.() || '';
    return hostId ? [hostId, `user:${hostId}`] : [];
  }

  function ensureLiveInteractionMembership(streamId, actor, payload = {}) {
    if (!streamId || !actor?.userId) return;
    livestreamService.joinLiveRooms(socket, streamId);
    livestreamService.addLiveParticipant(streamId, actor.userId, payload.agoraUid);
    if (payload.liveRole === 'broadcaster') {
      socket.data.hostLiveStreams.add(streamId);
    } else {
      socket.data.liveStreams.add(streamId);
    }
    if (!socket.data.liveJoinTimes.has(streamId)) {
      socket.data.liveJoinTimes.set(streamId, Date.now());
    }
  }

  async function endLiveStreamForHostDrop(streamId, socketId) {
    if (!mongoose.Types.ObjectId.isValid(streamId)) return;
    const stream = await LiveStream.findOneAndUpdate(
      {
        _id: streamId,
        isLive: true,
        lifecycleStatus: 'live',
        hostConnected: true,
        hostSocketId: socketId,
      },
      {
        $set: {
          isLive: false,
          lifecycleStatus: 'ended',
          hostConnected: false,
          hostSocketId: '',
          endedAt: new Date(),
          endReason: 'host_disconnected',
          viewerCount: 0,
        },
      },
      { new: true },
    );
    if (!stream) return;

    const endedEvent = {
      streamId,
      reason: 'host_disconnected',
    };
    livestreamService.emitToLiveRoom(streamId, 'live_ended', endedEvent);
    emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_ENDED, stream.hostId?.toString?.(), {
      ...endedEvent,
      hostId: stream.hostId?.toString?.(),
    });
    io.emit('live_removed', endedEvent);
    livestreamService.clearLiveParticipants(streamId);
    console.log(`📺 Livestream ${streamId} ended after host socket ${socketId} disconnected.`);
  }

  const handleLiveHostReady = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const userId = (socket.data.userId || payload.userId)?.toString();
      if (!streamId || !mongoose.Types.ObjectId.isValid(streamId) || !userId) return;

      const now = new Date();
      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: userId,
        lifecycleStatus: { $in: ['starting', 'live'] },
      });
      if (!stream) return;

      stream.isLive = true;
      stream.lifecycleStatus = 'live';
      stream.hostConnected = true;
      stream.hostSocketId = socket.id;
      stream.hostJoinedAt = stream.hostJoinedAt || now;
      stream.hostLastSeenAt = now;
      stream.startupExpiresAt = null;
      await stream.save();

      livestreamService.clearLiveHostDisconnectTimer(streamId);
      livestreamService.joinLiveRooms(socket, streamId);
      socket.data.hostLiveStreams.add(streamId);
      livestreamService.logLiveSocketUid('host_ready', {
        streamId,
        userId,
        agoraUid: payload.agoraUid,
        role: payload.liveRole || 'broadcaster',
        socketId: socket.id,
      });
      livestreamService.addLiveParticipant(streamId, userId, payload.agoraUid);

      const actor = await resolveLiveActor(payload);
      livestreamService.emitLiveJoinAck(socket, {
        streamId,
        userId: actor.userId,
        username: actor.username,
        avatar: actor.avatar,
        agoraUid: payload.agoraUid,
        liveRole: 'broadcaster',
        viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_STARTED, actor.userId, {
        streamId,
        hostId: stream.hostId?.toString?.(),
        agoraUid: payload.agoraUid,
        liveRole: 'broadcaster',
        viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
        peakViewerCount: stream.peakViewerCount || livestreamService.getLiveRoomMemberCount(streamId),
        title: stream.title || '',
        community: stream.community || '',
      });

      io.emit('live_started', { stream: livestreamService.serializeLiveStream(stream) });
      queueLivestreamStartNotifications({ streamId });
      livestreamService.emitLiveRoomMemberCount(streamId);
      console.log(`📺 Livestream host ready: ${streamId} socket=${socket.id}`);
    } catch (err) {
      console.error('❌ livestream_host_ready failed:', err.message);
    }
  };

  const handleLiveHostHeartbeat = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const userId = (socket.data.userId || payload.userId)?.toString();
      if (!streamId || !mongoose.Types.ObjectId.isValid(streamId) || !userId) return;

      await LiveStream.updateOne(
        {
          _id: streamId,
          hostId: userId,
          lifecycleStatus: 'live',
          hostSocketId: socket.id,
        },
        { $set: { hostLastSeenAt: new Date(), hostConnected: true } },
      );
      livestreamService.logLiveSocketUid('host_heartbeat', {
        streamId,
        userId,
        agoraUid: payload.agoraUid,
        role: payload.liveRole || 'broadcaster',
        socketId: socket.id,
      });
    } catch (err) {
      console.error('❌ livestream_host_heartbeat failed:', err.message);
    }
  };

  const handleLiveJoin = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      if (socket.data.hostLiveStreams.has(streamId)) {
        livestreamService.joinLiveRooms(socket, streamId);
        livestreamService.emitLiveRoomMemberCount(streamId);
        const actor = await resolveLiveActor(payload);
        livestreamService.emitLiveJoinAck(socket, {
          streamId,
          userId: actor.userId,
          username: actor.username,
          avatar: actor.avatar,
          agoraUid: payload.agoraUid,
          liveRole: payload.liveRole || 'broadcaster',
          viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
        });
        return;
      }

      if (socket.data.liveStreams.has(streamId)) {
        livestreamService.joinLiveRooms(socket, streamId);
        livestreamService.emitLiveRoomMemberCount(streamId);
        const actor = await resolveLiveActor(payload);
        livestreamService.emitLiveJoinAck(socket, {
          streamId,
          userId: actor.userId,
          username: actor.username,
          avatar: actor.avatar,
          agoraUid: payload.agoraUid,
          liveRole: payload.liveRole || 'audience',
          viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
        });
        return;
      }

      const actor = await resolveLiveActor(payload);
      livestreamService.logLiveSocketUid('join', {
        streamId,
        userId: actor.userId,
        agoraUid: payload.agoraUid,
        role: payload.liveRole || 'audience',
        socketId: socket.id,
      });
      livestreamService.joinLiveRooms(socket, streamId);
      socket.data.liveStreams.add(streamId);
      socket.data.liveJoinTimes.set(streamId, Date.now());
      livestreamService.addLiveParticipant(streamId, actor.userId, payload.agoraUid);
      const stream = await updateLiveViewerCount(streamId);
      if (!stream) {
        livestreamService.leaveLiveRooms(socket, streamId);
        socket.data.liveStreams.delete(streamId);
        livestreamService.removeLiveParticipant(streamId, actor.userId);
        return;
      }

      const event = {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || 'audience',
        username: actor.username,
        avatar: actor.avatar,
        viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
        hostId: stream.hostId?.toString?.(),
        title: stream.title || '',
        community: stream.community || '',
      };
      livestreamService.emitToLiveRoom(streamId, 'live_join', event);
      livestreamService.emitToLiveRoom(streamId, 'viewer_joined', event);
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_JOINED, actor.userId, event);
      livestreamService.emitLiveRoomMemberCount(streamId);
      livestreamService.emitLiveJoinAck(socket, {
        streamId,
        userId: actor.userId,
        username: actor.username,
        avatar: actor.avatar,
        agoraUid: payload.agoraUid,
        liveRole: payload.liveRole || 'audience',
        viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
      });
    } catch (err) {
      console.error('❌ live_join failed:', err.message);
    }
  };

  const handleLiveLeave = async (payload = {}) => {
    try {
      const streamId = (payload.streamId || payload)?.toString();
      const isAudienceParticipant = socket.data.liveStreams.has(streamId);
      const isHostParticipant = socket.data.hostLiveStreams.has(streamId);
      if (!streamId || (!isAudienceParticipant && !isHostParticipant)) return;
      const actor = await resolveLiveActor(payload);
      livestreamService.logLiveSocketUid('leave', {
        streamId,
        userId: actor.userId,
        agoraUid: payload.agoraUid,
        role: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
        socketId: socket.id,
      });
      const durationMs = Math.max(0, Date.now() - Number(socket.data.liveJoinTimes.get(streamId) || Date.now()));
      const leaveEvent = {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
        username: actor.username,
        avatar: actor.avatar,
        durationMs,
        createdAt: new Date().toISOString(),
      };
      livestreamService.emitToLiveRoom(streamId, 'live_leave', leaveEvent);
      livestreamService.emitToLiveRoom(streamId, 'viewer_left', leaveEvent);
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_LEFT, actor.userId, {
        streamId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
        durationMs,
        createdAt: new Date().toISOString(),
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION, actor.userId, {
        streamId,
        durationMs,
        watchTimeMs: durationMs,
        createdAt: new Date().toISOString(),
      });
      socket.data.liveStreams.delete(streamId);
      socket.data.hostLiveStreams.delete(streamId);
      socket.data.liveJoinTimes.delete(streamId);
      livestreamService.removeLiveParticipant(streamId, actor.userId);
      const guestLeaveResult = await LiveStream.updateOne(
        { _id: streamId, 'guests.userId': actor.userId },
        { $pull: { guests: { userId: actor.userId } } },
      );
      if (guestLeaveResult.modifiedCount > 0) {
        livestreamService.emitToLiveRoom(streamId, 'live_guest_left', {
          streamId,
          guestUserId: actor.userId,
        });
      }
      livestreamService.leaveLiveRooms(socket, streamId);
      if (isAudienceParticipant) {
        await updateLiveViewerCount(streamId);
      }
      livestreamService.emitLiveRoomMemberCount(streamId);
    } catch (err) {
      console.error('❌ live_leave failed:', err.message);
    }
  };

  const handleLiveComment = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const message = payload.message?.toString?.().trim();
      if (!streamId || !message) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('comment', payload)) return;
      const actor = await resolveLiveActor(payload);
      const stream = await resolveLiveStreamContext(streamId);
      ensureLiveInteractionMembership(streamId, actor, payload);
      const commentEvent = {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || '',
        username: actor.username,
        avatar: actor.avatar,
        message: message.slice(0, 240),
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      const fallbackRooms = hostFallbackRooms(stream);
      livestreamService.emitToLiveRoom(streamId, 'live_comment', commentEvent, fallbackRooms);
      livestreamService.emitToLiveRoom(streamId, 'new_comment', commentEvent, fallbackRooms);
      socket.emit('live_comment_ack', {
        success: true,
        streamId,
        clientEventId: commentEvent.clientEventId,
        createdAt: commentEvent.createdAt,
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_COMMENT, actor.userId, commentEvent);
    } catch (err) {
      console.error('❌ live_comment failed:', err.message);
    }
  };

  const handleLiveReaction = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('reaction', payload)) return;
      const actor = await resolveLiveActor(payload);
      const stream = await resolveLiveStreamContext(streamId);
      ensureLiveInteractionMembership(streamId, actor, payload);
      const updatedStream = await LiveStream.findOneAndUpdate(
        { _id: streamId, isLive: true },
        { $inc: { likeCount: 1 } },
        { new: true, projection: { likeCount: 1 } },
      ).lean();
      const memoryLikeCount = livestreamService.incrementLiveReactionCount(streamId);
      const likeCount = Number(updatedStream?.likeCount || memoryLikeCount || 0);
      const reactionEvent = {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || '',
        username: actor.username,
        reaction: payload.reaction || '🔥',
        type: payload.type || payload.reaction || '🔥',
        likeCount,
        totalLikes: likeCount,
        reactionCount: likeCount,
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      const fallbackRooms = hostFallbackRooms(stream);
      livestreamService.emitToLiveRoom(streamId, 'live_reaction', reactionEvent, fallbackRooms);
      livestreamService.emitToLiveRoom(streamId, 'new_like', reactionEvent, fallbackRooms);
      socket.emit('live_like_ack', {
        success: true,
        streamId,
        clientEventId: reactionEvent.clientEventId,
        likeCount,
        createdAt: reactionEvent.createdAt,
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_LIKE, actor.userId, reactionEvent);
    } catch (err) {
      console.error('❌ live_reaction failed:', err.message);
    }
  };

  const handleLiveShare = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('share', payload)) return;
      const actor = await resolveLiveActor(payload);
      const shareEvent = {
        streamId,
        userId: actor.userId,
        username: actor.username,
        target: payload.target || payload.shareTarget || '',
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      livestreamService.emitToLiveRoom(streamId, 'live_share', shareEvent);
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_SHARE, actor.userId, shareEvent);
    } catch (err) {
      console.error('❌ live_share failed:', err.message);
    }
  };

  const handleLiveReport = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('report', payload)) return;
      const actor = await resolveLiveActor(payload);
      const reportEvent = {
        streamId,
        userId: actor.userId,
        username: actor.username,
        targetUserId: payload.targetUserId?.toString?.() || '',
        reason: String(payload.reason || 'livestream_report').trim().slice(0, 240),
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      io.to(actor.userId).emit('live_report_received', reportEvent);
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_REPORT, actor.userId, reportEvent);
    } catch (err) {
      console.error('❌ live_report failed:', err.message);
    }
  };

  const handleLiveFollowHost = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('follow_host', payload)) return;
      const actor = await resolveLiveActor(payload);
      const followEvent = {
        streamId,
        userId: actor.userId,
        username: actor.username,
        hostId: payload.hostId?.toString?.() || payload.targetUserId?.toString?.() || '',
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      livestreamService.emitToLiveRoom(streamId, 'live_follow_host', followEvent);
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_FOLLOW_HOST, actor.userId, followEvent);
    } catch (err) {
      console.error('❌ live_follow_host failed:', err.message);
    }
  };

  const handleLivePinComment = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId || !mongoose.Types.ObjectId.isValid(streamId)) return;
      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: socket.data.userId,
        isLive: true,
      }).select('hostId').lean();
      if (!stream) return;

      const pinEvent = {
        streamId,
        hostId: stream.hostId.toString(),
        commentId: payload.commentId?.toString?.() || payload.clientEventId || '',
        message: String(payload.message || '').trim().slice(0, 240),
        pinnedBy: socket.data.userId,
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      livestreamService.emitToLiveRoom(streamId, 'live_comment_pinned', pinEvent);
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_PIN_COMMENT, socket.data.userId, pinEvent);
    } catch (err) {
      console.error('❌ live_pin_comment failed:', err.message);
    }
  };

  const handleLiveModerationAction = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId || !mongoose.Types.ObjectId.isValid(streamId)) return;
      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: socket.data.userId,
        isLive: true,
      }).select('hostId').lean();
      if (!stream) return;

      const action = String(payload.action || 'moderation_action').trim().slice(0, 80);
      const eventType =
        action === 'ban_user'
          ? LIVESTREAM_EVENT_TYPES.STREAM_BAN_USER
          : action === 'warning'
            ? LIVESTREAM_EVENT_TYPES.STREAM_WARNING
            : LIVESTREAM_EVENT_TYPES.STREAM_MODERATION_ACTION;
      const moderationEvent = {
        streamId,
        hostId: stream.hostId.toString(),
        targetUserId: payload.targetUserId?.toString?.() || '',
        action,
        reason: String(payload.reason || '').trim().slice(0, 240),
        createdAt: new Date().toISOString(),
      };
      livestreamService.emitToLiveRoom(streamId, 'live_moderation_action', moderationEvent);
      emitLiveOperationalEvent(eventType, socket.data.userId, moderationEvent);
    } catch (err) {
      console.error('❌ live_moderation_action failed:', err.message);
    }
  };

  const handleLiveViewDuration = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      const actor = await resolveLiveActor(payload);
      const durationMs = Math.max(
        0,
        Number(payload.durationMs || payload.watchTimeMs || 0) ||
          Date.now() - Number(socket.data.liveJoinTimes.get(streamId) || Date.now()),
      );
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION, actor.userId, {
        streamId,
        durationMs,
        watchTimeMs: durationMs,
        liveRole: payload.liveRole || '',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('❌ live_view_duration failed:', err.message);
    }
  };

  const handleLiveRequestGuestSeat = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId || !mongoose.Types.ObjectId.isValid(streamId)) return;
      const actor = await resolveLiveActor(payload);
      if (!actor.userId || !mongoose.Types.ObjectId.isValid(actor.userId)) return;

      const stream = await LiveStream.findOne({
        _id: streamId,
        isLive: true,
        lifecycleStatus: 'live',
        hostConnected: true,
      })
        .select('hostId guests')
        .lean();
      if (!stream) return;
      if (stream.hostId.toString() === actor.userId.toString()) return;

      const expectedUid = livestreamService.expectedAgoraUidForUser(actor.userId);
      const payloadUid = livestreamService.normalizeAgoraUid(payload.agoraUid);
      if (!expectedUid) return;
      if (payloadUid && payloadUid !== expectedUid) {
        console.warn('[YenkasaLiveSocket][guest_uid_mismatch]', {
          event: 'live_request_guest_seat',
          streamId,
          userId: actor.userId,
          payloadAgoraUid: payloadUid,
          expectedAgoraUid: expectedUid,
          socketId: socket.id,
        });
      }

      io.to(stream.hostId.toString()).emit('live_guest_seat_requested', {
        streamId,
        userId: actor.userId,
        username: actor.username,
        avatar: actor.avatar,
        agoraUid: expectedUid,
        createdAt: new Date().toISOString(),
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_MODERATION_ACTION, actor.userId, {
        streamId,
        targetUserId: stream.hostId.toString(),
        hostId: stream.hostId.toString(),
        action: 'guest_request',
        agoraUid: expectedUid,
      });
    } catch (err) {
      console.error('❌ live_request_guest_seat failed:', err.message);
    }
  };

  const handleLiveApproveGuestSeat = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const guestUserId = payload.guestUserId?.toString();
      if (
        !streamId ||
        !mongoose.Types.ObjectId.isValid(streamId) ||
        !guestUserId ||
        !mongoose.Types.ObjectId.isValid(guestUserId)
      ) {
        return;
      }

      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: socket.data.userId,
        isLive: true,
        lifecycleStatus: 'live',
        hostConnected: true,
      });
      if (!stream) return;

      const guestActor = await User.findById(guestUserId).select('username profileImage avatar').lean();
      if (!guestActor) return;

      const expectedGuestUid = livestreamService.expectedAgoraUidForUser(guestUserId);
      const payloadGuestUid = livestreamService.normalizeAgoraUid(payload.guestAgoraUid);
      if (!expectedGuestUid) return;
      if (payloadGuestUid && payloadGuestUid !== expectedGuestUid) {
        console.warn('[YenkasaLiveSocket][guest_uid_mismatch]', {
          event: 'live_approve_guest_seat',
          streamId,
          guestUserId,
          payloadAgoraUid: payloadGuestUid,
          expectedAgoraUid: expectedGuestUid,
          socketId: socket.id,
        });
      }

      const guestData = {
        userId: guestUserId,
        username: guestActor.username,
        avatar: guestActor.profileImage || guestActor.avatar || '',
        agoraUid: expectedGuestUid,
        isMuted: false,
        isVideoStopped: false,
        joinedAt: new Date(),
      };

      await LiveStream.updateOne({ _id: streamId }, { $pull: { guests: { userId: guestUserId } } });
      await LiveStream.updateOne({ _id: streamId }, { $push: { guests: guestData } });

      livestreamService.emitToLiveRoom(streamId, 'live_guest_seat_approved', {
        streamId,
        guest: guestData,
        approvedBy: socket.data.userId,
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_MODERATION_ACTION, socket.data.userId, {
        streamId,
        hostId: stream.hostId?.toString?.(),
        guestUserId,
        guestAgoraUid: expectedGuestUid,
        action: 'guest_approved',
      });
    } catch (err) {
      console.error('❌ live_approve_guest_seat failed:', err.message);
    }
  };

  const handleLiveDeclineGuestSeat = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const guestUserId = payload.guestUserId?.toString();
      if (
        !streamId ||
        !mongoose.Types.ObjectId.isValid(streamId) ||
        !guestUserId ||
        !mongoose.Types.ObjectId.isValid(guestUserId)
      ) {
        return;
      }

      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: socket.data.userId,
        isLive: true,
      });
      if (!stream) return;

      io.to(guestUserId).emit('live_guest_seat_declined', { streamId });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_MODERATION_ACTION, socket.data.userId, {
        streamId,
        hostId: stream.hostId?.toString?.(),
        guestUserId,
        action: 'guest_declined',
      });
    } catch (err) {
      console.error('❌ live_decline_guest_seat failed:', err.message);
    }
  };

  const handleLiveMuteGuest = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const guestUserId = payload.guestUserId?.toString();
      const muted = Boolean(payload.muted);
      if (
        !streamId ||
        !mongoose.Types.ObjectId.isValid(streamId) ||
        !guestUserId ||
        !mongoose.Types.ObjectId.isValid(guestUserId)
      ) {
        return;
      }

      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: socket.data.userId,
        isLive: true,
      });
      if (!stream) return;

      await LiveStream.updateOne(
        { _id: streamId, 'guests.userId': guestUserId },
        { $set: { 'guests.$.isMuted': muted } },
      );

      livestreamService.emitToLiveRoom(streamId, 'live_guest_muted', { streamId, guestUserId, muted });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_MODERATION_ACTION, socket.data.userId, {
        streamId,
        hostId: stream.hostId?.toString?.(),
        guestUserId,
        action: muted ? 'guest_muted' : 'guest_unmuted',
        muted,
      });
    } catch (err) {
      console.error('❌ live_mute_guest failed:', err.message);
    }
  };

  const handleLiveKickGuest = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const guestUserId = payload.guestUserId?.toString();
      if (
        !streamId ||
        !mongoose.Types.ObjectId.isValid(streamId) ||
        !guestUserId ||
        !mongoose.Types.ObjectId.isValid(guestUserId)
      ) {
        return;
      }

      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: socket.data.userId,
        isLive: true,
      });
      if (!stream) return;

      await LiveStream.updateOne({ _id: streamId }, { $pull: { guests: { userId: guestUserId } } });
      livestreamService.emitToLiveRoom(streamId, 'live_guest_kicked', { streamId, guestUserId });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_BAN_USER, socket.data.userId, {
        streamId,
        hostId: stream.hostId?.toString?.(),
        targetUserId: guestUserId,
        action: 'guest_kicked',
      });
    } catch (err) {
      console.error('❌ live_kick_guest failed:', err.message);
    }
  };

  const handleLiveLeaveGuestSeat = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const actor = await resolveLiveActor(payload);
      if (
        !streamId ||
        !mongoose.Types.ObjectId.isValid(streamId) ||
        !actor.userId ||
        !mongoose.Types.ObjectId.isValid(actor.userId)
      ) {
        return;
      }

      const stream = await LiveStream.findOne({
        _id: streamId,
        isLive: true,
        'guests.userId': actor.userId,
      })
        .select('hostId guests')
        .lean();
      if (!stream) return;

      await LiveStream.updateOne({ _id: streamId }, { $pull: { guests: { userId: actor.userId } } });
      livestreamService.emitToLiveRoom(streamId, 'live_guest_left', {
        streamId,
        guestUserId: actor.userId,
        username: actor.username,
        selfClosed: true,
        createdAt: new Date().toISOString(),
      });
      emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_MODERATION_ACTION, actor.userId, {
        streamId,
        hostId: stream.hostId?.toString?.(),
        guestUserId: actor.userId,
        action: 'guest_left_seat',
      });
    } catch (err) {
      console.error('❌ live_leave_guest_seat failed:', err.message);
    }
  };

  socket.on('live_host_ready', handleLiveHostReady);
  socket.on('live_host_heartbeat', handleLiveHostHeartbeat);
  socket.on('live_join', handleLiveJoin);
  socket.on('live_leave', handleLiveLeave);
  socket.on('live_comment', handleLiveComment);
  socket.on('live_reaction', handleLiveReaction);
  socket.on('live_like', handleLiveReaction);
  socket.on('send_like', handleLiveReaction);
  socket.on('streamLike', handleLiveReaction);
  socket.on('likeStream', handleLiveReaction);
  socket.on('live_share', handleLiveShare);
  socket.on('live_report', handleLiveReport);
  socket.on('live_follow_host', handleLiveFollowHost);
  socket.on('live_pin_comment', handleLivePinComment);
  socket.on('live_moderation_action', handleLiveModerationAction);
  socket.on('live_ban_user', (payload = {}) => handleLiveModerationAction({ ...payload, action: 'ban_user' }));
  socket.on('live_warning', (payload = {}) => handleLiveModerationAction({ ...payload, action: 'warning' }));
  socket.on('live_view_duration', handleLiveViewDuration);
  socket.on('live_request_guest_seat', handleLiveRequestGuestSeat);
  socket.on('live_approve_guest_seat', handleLiveApproveGuestSeat);
  socket.on('live_decline_guest_seat', handleLiveDeclineGuestSeat);
  socket.on('live_mute_guest', handleLiveMuteGuest);
  socket.on('live_kick_guest', handleLiveKickGuest);
  socket.on('live_leave_guest_seat', handleLiveLeaveGuestSeat);

  async function cleanupDisconnectedSocket(reason) {
    if (socket.data.hostLiveStreams?.size) {
      for (const streamId of Array.from(socket.data.hostLiveStreams)) {
        livestreamService.removeLiveParticipant(streamId, socket.data.userId);
        livestreamService.clearLiveHostDisconnectTimer(streamId);
        const timer = setTimeout(() => {
          livestreamService.liveHostDisconnectTimers.delete(streamId);
          endLiveStreamForHostDrop(streamId, socket.id).catch((err) => {
            console.error('❌ Error ending livestream after host disconnect:', err.message);
          });
        }, livestreamService.LIVE_HOST_DISCONNECT_GRACE_MS);
        livestreamService.liveHostDisconnectTimers.set(streamId, timer);
      }
      socket.data.hostLiveStreams.clear();
    }

    if (socket.data.liveStreams?.size) {
      await Promise.allSettled(
        Array.from(socket.data.liveStreams).map(async (streamId) => {
          const durationMs = Math.max(0, Date.now() - Number(socket.data.liveJoinTimes.get(streamId) || Date.now()));
          emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_LEFT, socket.data.userId, {
            streamId,
            durationMs,
            disconnectReason: reason,
            createdAt: new Date().toISOString(),
          });
          emitLiveOperationalEvent(LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION, socket.data.userId, {
            streamId,
            durationMs,
            watchTimeMs: durationMs,
            disconnectReason: reason,
            createdAt: new Date().toISOString(),
          });
          livestreamService.removeLiveParticipant(streamId, socket.data.userId);
          const guestLeaveResult = await LiveStream.updateOne(
            { _id: streamId, 'guests.userId': socket.data.userId },
            { $pull: { guests: { userId: socket.data.userId } } },
          );
          if (guestLeaveResult.modifiedCount > 0) {
            livestreamService.emitToLiveRoom(streamId, 'live_guest_left', {
              streamId,
              guestUserId: socket.data.userId,
            });
          }
          return updateLiveViewerCount(streamId);
        }),
      );
      socket.data.liveStreams.clear();
      socket.data.liveJoinTimes.clear();
    }
  }

  return {
    cleanupDisconnectedSocket,
  };
}

module.exports = registerLivestreamEvents;
