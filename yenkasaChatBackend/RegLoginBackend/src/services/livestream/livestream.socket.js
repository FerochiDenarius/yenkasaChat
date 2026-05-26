const livestreamService = require('./livestream.service');
const { publishEvent } = require('../../yme/core/eventBus');
const { createLogger } = require('../../yme/observability/logger');

const logger = createLogger('socket.livestream', {
  sourceModule: 'socket.livestream',
});

function registerLivestreamEvents(io, socket, { mongoose, User, LiveStream }) {
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
    return stream;
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
    io.emit('live_removed', endedEvent);
    livestreamService.clearLiveParticipants(streamId);
    logger.info('Livestream ended after host disconnect.', {
      data: {
        streamId,
        socketId,
      },
    });
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

      io.emit('live_started', { stream: livestreamService.serializeLiveStream(stream) });
      livestreamService.emitLiveRoomMemberCount(streamId);
      logger.info('Livestream host ready.', {
        userId: actor.userId,
        data: {
          streamId,
          socketId: socket.id,
        },
      });
      publishEvent({
        category: 'engagement',
        eventName: 'live_stream_started',
        eventType: 'live_stream_join',
        ymeEligible: Boolean(actor.userId),
        userId: actor.userId,
        contentId: streamId,
        sourceApp: 'social_app',
        sourceModule: 'socket.live_host_ready',
        sessionId: socket.id,
        metadata: {
          streamId,
          liveRole: 'broadcaster',
          agoraUid: payload.agoraUid || '',
        },
      });
    } catch (err) {
      logger.error('livestream_host_ready failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
      logger.error('livestream_host_heartbeat failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
      };
      livestreamService.emitToLiveRoom(streamId, 'live_join', event);
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
      publishEvent({
        category: 'engagement',
        eventName: 'live_stream_joined',
        eventType: 'live_stream_join',
        ymeEligible: Boolean(actor.userId),
        userId: actor.userId,
        contentId: streamId,
        sourceApp: 'social_app',
        sourceModule: 'socket.live_join',
        sessionId: socket.id,
        metadata: {
          streamId,
          liveRole: payload.liveRole || 'audience',
          viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
        },
      });
    } catch (err) {
      logger.error('live_join failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
      livestreamService.emitToLiveRoom(streamId, 'live_leave', {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
        username: actor.username,
        avatar: actor.avatar,
        createdAt: new Date().toISOString(),
      });
      socket.data.liveStreams.delete(streamId);
      socket.data.hostLiveStreams.delete(streamId);
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
      publishEvent({
        category: 'analytics_event',
        eventName: 'live_stream_left',
        severity: 'info',
        userId: actor.userId,
        contentId: streamId,
        sourceApp: 'social_app',
        sourceModule: 'socket.live_leave',
        sessionId: socket.id,
        metadata: {
          streamId,
          liveRole: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
        },
      });
    } catch (err) {
      logger.error('live_leave failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
    }
  };

  const handleLiveComment = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const message = payload.message?.toString?.().trim();
      if (!streamId || !message) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('comment', payload)) return;
      const actor = await resolveLiveActor(payload);
      livestreamService.emitToLiveRoom(streamId, 'live_comment', {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || '',
        username: actor.username,
        avatar: actor.avatar,
        message: message.slice(0, 240),
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      });
      publishEvent({
        category: 'engagement',
        eventName: 'live_comment',
        eventType: 'live_interaction',
        ymeEligible: Boolean(actor.userId),
        userId: actor.userId,
        contentId: streamId,
        sourceApp: 'social_app',
        sourceModule: 'socket.live_comment',
        sessionId: socket.id,
        metadata: {
          streamId,
          liveRole: payload.liveRole || '',
          clientEventId: payload.clientEventId || '',
          message,
        },
        payload: {
          message,
        },
      });
    } catch (err) {
      logger.error('live_comment failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
    }
  };

  const handleLiveReaction = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId) return;
      if (livestreamService.shouldSkipDuplicateLiveEvent('reaction', payload)) return;
      const actor = await resolveLiveActor(payload);
      livestreamService.emitToLiveRoom(streamId, 'live_reaction', {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || '',
        username: actor.username,
        reaction: payload.reaction || '🔥',
        type: payload.type || payload.reaction || '🔥',
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      });
      publishEvent({
        category: 'engagement',
        eventName: 'live_reaction',
        eventType: 'live_interaction',
        ymeEligible: Boolean(actor.userId),
        userId: actor.userId,
        contentId: streamId,
        sourceApp: 'social_app',
        sourceModule: 'socket.live_reaction',
        sessionId: socket.id,
        metadata: {
          streamId,
          liveRole: payload.liveRole || '',
          reaction: payload.reaction || '🔥',
          clientEventId: payload.clientEventId || '',
        },
      });
    } catch (err) {
      logger.error('live_reaction failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
        logger.warn('Guest seat request UID mismatch detected.', {
          userId: actor.userId,
          data: {
            event: 'live_request_guest_seat',
            streamId,
            payloadAgoraUid: payloadUid,
            expectedAgoraUid: expectedUid,
            socketId: socket.id,
          },
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
    } catch (err) {
      logger.error('live_request_guest_seat failed.', {
        userId: socket.data.userId || payload.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
        logger.warn('Guest seat approval UID mismatch detected.', {
          userId: socket.data.userId || '',
          data: {
            event: 'live_approve_guest_seat',
            streamId,
            guestUserId,
            payloadAgoraUid: payloadGuestUid,
            expectedAgoraUid: expectedGuestUid,
            socketId: socket.id,
          },
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
    } catch (err) {
      logger.error('live_approve_guest_seat failed.', {
        userId: socket.data.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          guestUserId: payload.guestUserId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
    } catch (err) {
      logger.error('live_decline_guest_seat failed.', {
        userId: socket.data.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          guestUserId: payload.guestUserId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
    } catch (err) {
      logger.error('live_mute_guest failed.', {
        userId: socket.data.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          guestUserId: payload.guestUserId?.toString?.() || '',
          socketId: socket.id,
        },
      });
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
    } catch (err) {
      logger.error('live_kick_guest failed.', {
        userId: socket.data.userId || '',
        error: err,
        data: {
          streamId: payload.streamId?.toString?.() || '',
          guestUserId: payload.guestUserId?.toString?.() || '',
          socketId: socket.id,
        },
      });
    }
  };

  socket.on('live_host_ready', handleLiveHostReady);
  socket.on('live_host_heartbeat', handleLiveHostHeartbeat);
  socket.on('live_join', handleLiveJoin);
  socket.on('live_leave', handleLiveLeave);
  socket.on('live_comment', handleLiveComment);
  socket.on('live_reaction', handleLiveReaction);
  socket.on('live_request_guest_seat', handleLiveRequestGuestSeat);
  socket.on('live_approve_guest_seat', handleLiveApproveGuestSeat);
  socket.on('live_decline_guest_seat', handleLiveDeclineGuestSeat);
  socket.on('live_mute_guest', handleLiveMuteGuest);
  socket.on('live_kick_guest', handleLiveKickGuest);

  async function cleanupDisconnectedSocket(reason) {
    if (socket.data.hostLiveStreams?.size) {
      for (const streamId of Array.from(socket.data.hostLiveStreams)) {
        livestreamService.removeLiveParticipant(streamId, socket.data.userId);
        livestreamService.clearLiveHostDisconnectTimer(streamId);
        const timer = setTimeout(() => {
          livestreamService.liveHostDisconnectTimers.delete(streamId);
          endLiveStreamForHostDrop(streamId, socket.id).catch((err) => {
            logger.error('Failed to end livestream after host disconnect.', {
              userId: socket.data.userId || '',
              error: err,
              data: {
                streamId,
                socketId: socket.id,
                reason,
              },
            });
          });
        }, livestreamService.LIVE_HOST_DISCONNECT_GRACE_MS);
        livestreamService.liveHostDisconnectTimers.set(streamId, timer);
      }
      socket.data.hostLiveStreams.clear();
    }

    if (socket.data.liveStreams?.size) {
      await Promise.allSettled(
        Array.from(socket.data.liveStreams).map(async (streamId) => {
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
    }
  }

  return {
    cleanupDisconnectedSocket,
  };
}

module.exports = registerLivestreamEvents;
