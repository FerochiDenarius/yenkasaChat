const livestreamService = require('./livestream.service');
const { publishYmeEvent } = require('../../yme/services/eventPublisher.service');

function registerLivestreamEvents(io, socket, { mongoose, User, LiveStream }) {
  function emitYmeLiveEvent(eventType, actorUserId, payload = {}) {
    const userId = String(actorUserId || socket.data.userId || payload.userId || '').trim();
    if (!userId) return;

    publishYmeEvent({
      eventType,
      userId,
      relatedUserId: payload.relatedUserId || payload.guestUserId || payload.targetUserId || '',
      sourceApp: 'live_arena',
      platform: 'socket',
      sessionId: socket.id,
      contentId: payload.streamId || '',
      postId: payload.streamId || '',
      clientEventId: payload.clientEventId || '',
      occurredAt: payload.createdAt || new Date().toISOString(),
      text: payload.message || payload.reaction || payload.reason || '',
      payload: {
        ...payload,
        socketEventSource: 'livestream.socket',
      },
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
    emitYmeLiveEvent('viewer_count_updated', stream.hostId?.toString?.(), {
      streamId,
      viewerCount: stream.viewerCount,
      peakViewerCount: stream.peakViewerCount || stream.viewerCount,
    });
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
    emitYmeLiveEvent('live_ended', stream.hostId?.toString?.(), endedEvent);
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
      emitYmeLiveEvent('live_started', actor.userId, {
        streamId,
        agoraUid: payload.agoraUid,
        liveRole: 'broadcaster',
        viewerCount: livestreamService.getLiveRoomMemberCount(streamId),
      });

      io.emit('live_started', { stream: livestreamService.serializeLiveStream(stream) });
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
      emitYmeLiveEvent('live_joined', actor.userId, event);
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
      livestreamService.emitToLiveRoom(streamId, 'live_leave', {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
        username: actor.username,
        avatar: actor.avatar,
        createdAt: new Date().toISOString(),
      });
      emitYmeLiveEvent('live_left', actor.userId, {
        streamId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || (isHostParticipant ? 'broadcaster' : 'audience'),
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
      livestreamService.emitToLiveRoom(streamId, 'live_comment', commentEvent);
      emitYmeLiveEvent('live_comment', actor.userId, commentEvent);
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
      const reactionEvent = {
        streamId,
        userId: actor.userId,
        agoraUid: livestreamService.normalizeAgoraUid(payload.agoraUid),
        liveRole: payload.liveRole || '',
        username: actor.username,
        reaction: payload.reaction || '🔥',
        type: payload.type || payload.reaction || '🔥',
        clientEventId: payload.clientEventId || '',
        createdAt: new Date().toISOString(),
      };
      livestreamService.emitToLiveRoom(streamId, 'live_reaction', reactionEvent);
      emitYmeLiveEvent('live_reaction', actor.userId, reactionEvent);
    } catch (err) {
      console.error('❌ live_reaction failed:', err.message);
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
      emitYmeLiveEvent('guest_request', actor.userId, {
        streamId,
        targetUserId: stream.hostId.toString(),
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
      emitYmeLiveEvent('guest_approved', socket.data.userId, {
        streamId,
        guestUserId,
        guestAgoraUid: expectedGuestUid,
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
      emitYmeLiveEvent('guest_declined', socket.data.userId, {
        streamId,
        guestUserId,
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
    } catch (err) {
      console.error('❌ live_kick_guest failed:', err.message);
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
