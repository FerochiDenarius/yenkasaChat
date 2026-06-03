const { agoraUidFromUserId } = require('../../../utils/agoraTokenGenerator');

const LIVE_HOST_DISCONNECT_GRACE_MS = Number(
  process.env.LIVESTREAM_HOST_DISCONNECT_GRACE_MS || 45000,
);
const LIVE_EVENT_DEDUPE_TTL_MS = Number(process.env.LIVESTREAM_EVENT_DEDUPE_TTL_MS || 30000);

const liveHostDisconnectTimers = new Map();
const liveEventDedupe = new Map();
const liveParticipants = new Map();
const liveParticipantAgoraUids = new Map();
const liveReactionCounts = new Map();

let ioRef = null;

function configureLivestreamRealtime(io) {
  ioRef = io;
}

function getLiveRoom(streamId) {
  return `stream:${streamId}`;
}

function getLegacyLiveRoom(streamId) {
  return `livestream_${streamId}`;
}

function getDeprecatedLiveRoom(streamId) {
  return `live:${streamId}`;
}

function getLiveParticipantSet(streamId) {
  const normalizedStreamId = streamId?.toString();
  if (!normalizedStreamId) return new Set();
  if (!liveParticipants.has(normalizedStreamId)) {
    liveParticipants.set(normalizedStreamId, new Set());
  }
  return liveParticipants.get(normalizedStreamId);
}

function normalizeAgoraUid(value) {
  const uid = Number(value);
  return Number.isInteger(uid) && uid > 0 && uid <= 2147483647 ? uid : null;
}

function expectedAgoraUidForUser(userId) {
  try {
    return userId ? agoraUidFromUserId(userId) : null;
  } catch (err) {
    return null;
  }
}

function logLiveSocketUid(event, { streamId, userId, agoraUid, role, socketId }) {
  const expectedUid = expectedAgoraUidForUser(userId);
  const normalizedUid = normalizeAgoraUid(agoraUid);
  const uidMatchesUser = Boolean(expectedUid && normalizedUid && expectedUid === normalizedUid);

  console.log('[YenkasaLiveSocket][uid]', {
    event,
    streamId: streamId?.toString?.(),
    userId: userId?.toString?.(),
    socketId,
    role: role || '',
    payloadAgoraUid: normalizedUid,
    expectedAgoraUid: expectedUid,
    uidMatchesUser,
  });

  if (expectedUid && normalizedUid && expectedUid !== normalizedUid) {
    console.warn('[YenkasaLiveSocket][uid_mismatch]', {
      event,
      streamId: streamId?.toString?.(),
      userId: userId?.toString?.(),
      payloadAgoraUid: normalizedUid,
      expectedAgoraUid: expectedUid,
      socketId,
    });
  }
}

function rememberLiveParticipantAgoraUid(streamId, userId, agoraUid) {
  const normalizedStreamId = streamId?.toString();
  const normalizedUserId = userId?.toString();
  const normalizedAgoraUid = normalizeAgoraUid(agoraUid);
  if (!normalizedStreamId || !normalizedUserId || !normalizedAgoraUid) return;

  if (!liveParticipantAgoraUids.has(normalizedStreamId)) {
    liveParticipantAgoraUids.set(normalizedStreamId, new Map());
  }
  liveParticipantAgoraUids
    .get(normalizedStreamId)
    .set(normalizedUserId, normalizedAgoraUid);
}

function forgetLiveParticipantAgoraUid(streamId, userId) {
  const normalizedStreamId = streamId?.toString();
  const normalizedUserId = userId?.toString();
  if (!normalizedStreamId || !normalizedUserId || !liveParticipantAgoraUids.has(normalizedStreamId)) {
    return;
  }

  const participants = liveParticipantAgoraUids.get(normalizedStreamId);
  participants.delete(normalizedUserId);
  if (participants.size === 0) {
    liveParticipantAgoraUids.delete(normalizedStreamId);
  }
}

function addLiveParticipant(streamId, userId, agoraUid) {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return;
  getLiveParticipantSet(streamId).add(normalizedUserId);
  rememberLiveParticipantAgoraUid(streamId, normalizedUserId, agoraUid);
}

function removeLiveParticipant(streamId, userId) {
  const normalizedStreamId = streamId?.toString();
  const normalizedUserId = userId?.toString();
  if (!normalizedStreamId || !normalizedUserId || !liveParticipants.has(normalizedStreamId)) return;

  const participants = liveParticipants.get(normalizedStreamId);
  participants.delete(normalizedUserId);
  forgetLiveParticipantAgoraUid(normalizedStreamId, normalizedUserId);
  if (participants.size === 0) {
    liveParticipants.delete(normalizedStreamId);
  }
}

function clearLiveParticipants(streamId) {
  const normalizedStreamId = streamId?.toString();
  if (!normalizedStreamId) return;
  liveParticipants.delete(normalizedStreamId);
  liveParticipantAgoraUids.delete(normalizedStreamId);
  liveReactionCounts.delete(normalizedStreamId);
}

function incrementLiveReactionCount(streamId) {
  const normalizedStreamId = streamId?.toString();
  if (!normalizedStreamId) return 0;
  const nextCount = Number(liveReactionCounts.get(normalizedStreamId) || 0) + 1;
  liveReactionCounts.set(normalizedStreamId, nextCount);
  return nextCount;
}

function getLiveReactionCount(streamId) {
  return Number(liveReactionCounts.get(streamId?.toString()) || 0);
}

function getLiveTargetRooms(streamId) {
  return [
    getLiveRoom(streamId),
    getLegacyLiveRoom(streamId),
    getDeprecatedLiveRoom(streamId),
    ...Array.from(getLiveParticipantSet(streamId)),
  ];
}

function emitToLiveRoom(streamId, eventName, payload, extraRooms = []) {
  if (!ioRef) return;
  ioRef.to([
    ...getLiveTargetRooms(streamId),
    ...(extraRooms || []).filter(Boolean),
  ]).emit(eventName, payload);
}

function getLiveRoomMemberCount(streamId) {
  if (!ioRef) return liveParticipants.get(streamId?.toString())?.size || 0;
  const room = ioRef.sockets.adapter.rooms.get(getLiveRoom(streamId));
  const legacyRoom = ioRef.sockets.adapter.rooms.get(getLegacyLiveRoom(streamId));
  const deprecatedRoom = ioRef.sockets.adapter.rooms.get(getDeprecatedLiveRoom(streamId));
  const roomCount = Math.max(room?.size || 0, legacyRoom?.size || 0, deprecatedRoom?.size || 0);
  const participantCount = liveParticipants.get(streamId?.toString())?.size || 0;
  return Math.max(roomCount, participantCount);
}

function emitLiveRoomMemberCount(streamId) {
  const payload = {
    streamId: streamId?.toString(),
    viewerCount: getLiveRoomMemberCount(streamId),
  };
  emitToLiveRoom(streamId, 'live_viewer_count', payload);
  return payload.viewerCount;
}

function shouldSkipDuplicateLiveEvent(eventName, payload = {}) {
  const clientEventId = payload.clientEventId?.toString?.();
  if (!clientEventId) return false;

  const key = `${eventName}:${clientEventId}`;
  if (liveEventDedupe.has(key)) return true;

  liveEventDedupe.set(key, Date.now());
  setTimeout(() => liveEventDedupe.delete(key), LIVE_EVENT_DEDUPE_TTL_MS);
  return false;
}

function joinLiveRooms(socket, streamId) {
  socket.join(getLiveRoom(streamId));
  socket.join(getLegacyLiveRoom(streamId));
  socket.join(getDeprecatedLiveRoom(streamId));
}

function leaveLiveRooms(socket, streamId) {
  socket.leave(getLiveRoom(streamId));
  socket.leave(getLegacyLiveRoom(streamId));
  socket.leave(getDeprecatedLiveRoom(streamId));
}

function emitLiveJoinAck(socket, payload = {}) {
  if (!socket?.connected) return;
  socket.emit('live_room_joined', {
    success: true,
    streamId: payload.streamId?.toString?.() || '',
    userId: payload.userId?.toString?.() || '',
    username: payload.username || '',
    avatar: payload.avatar || '',
    agoraUid: normalizeAgoraUid(payload.agoraUid),
    liveRole: payload.liveRole || 'audience',
    viewerCount: Number(payload.viewerCount || 0),
    confirmedAt: new Date().toISOString(),
  });
}

function serializeLiveGuests(guests = []) {
  return (guests || [])
    .map((guest) => {
      let agoraUid = Number(guest.agoraUid || 0);
      if ((!Number.isInteger(agoraUid) || agoraUid <= 0) && guest.userId) {
        agoraUid = expectedAgoraUidForUser(guest.userId) || 0;
      }

      return {
        userId: guest.userId?.toString?.() || guest.userId || '',
        username: guest.username || '',
        avatar: guest.avatar || '',
        agoraUid,
        isMuted: Boolean(guest.isMuted),
        isVideoStopped: Boolean(guest.isVideoStopped),
        joinedAt: guest.joinedAt || null,
      };
    })
    .filter((guest) => guest.userId && guest.agoraUid > 0);
}

function serializeLiveStream(stream) {
  return {
    _id: stream._id.toString(),
    hostId: stream.hostId?.toString?.() || stream.hostId,
    hostUsername: stream.hostUsername || '',
    hostAvatar: stream.hostAvatar || '',
    title: stream.title || '',
    thumbnail: stream.thumbnail || '',
    community: stream.community || '',
    agoraChannel: stream.agoraChannel || '',
    isLive: Boolean(stream.isLive),
    lifecycleStatus: stream.lifecycleStatus || (stream.isLive ? 'live' : 'ended'),
    hostConnected: Boolean(stream.hostConnected),
    viewerCount: stream.viewerCount || 0,
    peakViewerCount: stream.peakViewerCount || 0,
    likeCount: stream.likeCount || 0,
    guests: serializeLiveGuests(stream.guests),
    hostRole: stream.hostRole || '',
    maxDurationMinutes: stream.maxDurationMinutes ?? null,
    scheduledEndAt: stream.scheduledEndAt || null,
    hostJoinedAt: stream.hostJoinedAt || null,
    hostLastSeenAt: stream.hostLastSeenAt || null,
    startupExpiresAt: stream.startupExpiresAt || null,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt,
  };
}

function clearLiveHostDisconnectTimer(streamId) {
  const normalizedStreamId = streamId?.toString();
  if (!normalizedStreamId) return;
  if (liveHostDisconnectTimers.has(normalizedStreamId)) {
    clearTimeout(liveHostDisconnectTimers.get(normalizedStreamId));
    liveHostDisconnectTimers.delete(normalizedStreamId);
  }
}

module.exports = {
  configureLivestreamRealtime,
  getLiveRoom,
  getLegacyLiveRoom,
  getDeprecatedLiveRoom,
  getLiveParticipantSet,
  normalizeAgoraUid,
  expectedAgoraUidForUser,
  logLiveSocketUid,
  emitToLiveRoom,
  emitLiveRoomMemberCount,
  getLiveReactionCount,
  addLiveParticipant,
  removeLiveParticipant,
  clearLiveParticipants,
  serializeLiveGuests,
  serializeLiveStream,
  getLiveRoomMemberCount,
  shouldSkipDuplicateLiveEvent,
  incrementLiveReactionCount,
  joinLiveRooms,
  leaveLiveRooms,
  emitLiveJoinAck,
  clearLiveHostDisconnectTimer,
  LIVE_HOST_DISCONNECT_GRACE_MS,
  liveHostDisconnectTimers,
};
