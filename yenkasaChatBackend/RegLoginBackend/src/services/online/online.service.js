const onlineUsers = new Map();
const pendingOfflineTimers = new Map();
const SOCKET_OFFLINE_GRACE_MS = Number(process.env.SOCKET_OFFLINE_GRACE_MS || 600000);
const PRESENCE_PREFIX = process.env.YENKASA_PRESENCE_REDIS_PREFIX || 'yenkasa:presence';
const PRESENCE_SOCKET_TTL_SECONDS = Number(process.env.YENKASA_PRESENCE_SOCKET_TTL_SECONDS || 86400);

let redisModulePromise = null;
let presenceRedis = null;

function redisUrl() {
  return process.env.YENKASA_PRESENCE_REDIS_URL ||
    process.env.YENKASA_SOCKET_REDIS_URL ||
    process.env.YENKASA_REDIS_URL ||
    process.env.REDIS_URL ||
    '';
}

function isRedisPresenceEnabled() {
  if (process.env.YENKASA_PRESENCE_REDIS_ENABLED === 'false') return false;
  return Boolean(
    redisUrl() ||
      process.env.YENKASA_PRESENCE_REDIS_HOST ||
      process.env.YENKASA_REDIS_HOST ||
      process.env.REDIS_HOST,
  );
}

async function loadRedis() {
  if (!redisModulePromise) {
    redisModulePromise = Promise.resolve().then(() => require('ioredis'));
  }
  return redisModulePromise;
}

async function getPresenceRedis() {
  if (!isRedisPresenceEnabled()) return null;
  if (presenceRedis) return presenceRedis;

  const IORedis = await loadRedis();
  const url = redisUrl();
  presenceRedis = url
    ? new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false })
    : new IORedis({
      host: process.env.YENKASA_PRESENCE_REDIS_HOST || process.env.YENKASA_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.YENKASA_PRESENCE_REDIS_PORT || process.env.YENKASA_REDIS_PORT || process.env.REDIS_PORT || 6379),
      password: process.env.YENKASA_PRESENCE_REDIS_PASSWORD || process.env.YENKASA_REDIS_PASSWORD || process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.YENKASA_PRESENCE_REDIS_DB || process.env.YENKASA_REDIS_DB || process.env.REDIS_DB || 0),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

  presenceRedis.on('error', (error) => {
    console.error('[Presence] Redis error:', error.message);
  });
  return presenceRedis;
}

function onlineSetKey() {
  return `${PRESENCE_PREFIX}:online_users`;
}

function userSocketSetKey(userId) {
  return `${PRESENCE_PREFIX}:user:${userId}:sockets`;
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

async function getOnlineUserIdsAsync() {
  const redis = await getPresenceRedis().catch(() => null);
  if (!redis) return getOnlineUserIds();
  return redis.smembers(onlineSetKey()).catch(() => getOnlineUserIds());
}

function clearPendingOfflineTimer(userId) {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return;

  const pendingTimer = pendingOfflineTimers.get(normalizedUserId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingOfflineTimers.delete(normalizedUserId);
    console.log(`🟢 Cleared pending offline timer for ${normalizedUserId}`);
  }
}

async function markUserOnline({ io, User, socket, userId }) {
  if (!userId) return;

  const normalizedUserId = userId.toString();
  clearPendingOfflineTimer(normalizedUserId);

  const socketIds = onlineUsers.get(normalizedUserId) || new Set();
  socketIds.add(socket.id);
  onlineUsers.set(normalizedUserId, socketIds);
  socket.data.userId = normalizedUserId;
  socket.join(normalizedUserId);
  socket.join(`user:${normalizedUserId}`);

  const redis = await getPresenceRedis().catch(() => null);
  if (redis) {
    const socketKey = userSocketSetKey(normalizedUserId);
    await redis
      .multi()
      .sadd(socketKey, socket.id)
      .expire(socketKey, PRESENCE_SOCKET_TTL_SECONDS)
      .sadd(onlineSetKey(), normalizedUserId)
      .exec()
      .catch((error) => console.error('[Presence] Redis online update failed:', error.message));
  }

  console.log(`🟢 User ${normalizedUserId} is online (${socketIds.size} active socket(s))`);

  await User.findByIdAndUpdate(normalizedUserId, { online: true, lastSeen: new Date() }, { new: true });
  io.emit('getOnlineUsers', await getOnlineUserIdsAsync());
  io.emit('userStatusChanged', {
    userId: normalizedUserId,
    isOnline: true,
    statusText: 'Online',
  });
}

async function markUserOffline({
  io,
  User,
  socket,
  userId,
  immediate = false,
  reason = 'socket_disconnect',
}) {
  if (!userId) return;

  const normalizedUserId = userId.toString();
  const socketIds = onlineUsers.get(normalizedUserId);
  const redis = await getPresenceRedis().catch(() => null);

  if (socketIds) {
    socketIds.delete(socket.id);
    if (redis) {
      await redis.srem(userSocketSetKey(normalizedUserId), socket.id)
        .catch((error) => console.error('[Presence] Redis socket removal failed:', error.message));
    }
    if (socketIds.size > 0) {
      onlineUsers.set(normalizedUserId, socketIds);
      console.log(
        `🟡 Socket ${socket.id} left user ${normalizedUserId}; ${socketIds.size} socket(s) still active.`,
      );
      io.emit('getOnlineUsers', await getOnlineUserIdsAsync());
      return;
    }

    onlineUsers.set(normalizedUserId, socketIds);
  }

  clearPendingOfflineTimer(normalizedUserId);

  const finalizeOffline = async () => {
    const latestSocketIds = onlineUsers.get(normalizedUserId);
    const redisSocketCount = redis
      ? await redis.scard(userSocketSetKey(normalizedUserId)).catch(() => 0)
      : 0;
    if (latestSocketIds && latestSocketIds.size > 0) {
      console.log(`🟢 Offline skipped for ${normalizedUserId}; user reconnected.`);
      return;
    }
    if (redisSocketCount > 0) {
      console.log(`🟢 Offline skipped for ${normalizedUserId}; user has Redis-tracked sockets.`);
      return;
    }

    console.log(`🔴 User ${normalizedUserId} went offline. reason=${reason}`);
    pendingOfflineTimers.delete(normalizedUserId);
    onlineUsers.delete(normalizedUserId);
    if (redis) {
      await redis
        .multi()
        .del(userSocketSetKey(normalizedUserId))
        .srem(onlineSetKey(), normalizedUserId)
        .exec()
        .catch((error) => console.error('[Presence] Redis offline update failed:', error.message));
    }

    await User.findByIdAndUpdate(normalizedUserId, { online: false, lastSeen: new Date() }, { new: true });

    io.emit('getOnlineUsers', await getOnlineUserIdsAsync());
    io.emit('userStatusChanged', {
      userId: normalizedUserId,
      isOnline: false,
      statusText: 'Offline',
    });
  };

  if (immediate) {
    await finalizeOffline();
    return;
  }

  console.log(
    `🟡 User ${normalizedUserId} has no active sockets. Waiting ${SOCKET_OFFLINE_GRACE_MS}ms before marking offline. reason=${reason}`,
  );
  const timer = setTimeout(() => {
    finalizeOffline().catch((err) => {
      console.error(`❌ Error finalizing offline for ${normalizedUserId}:`, err.message);
    });
  }, SOCKET_OFFLINE_GRACE_MS);
  pendingOfflineTimers.set(normalizedUserId, timer);
  io.emit('getOnlineUsers', await getOnlineUserIdsAsync());
}

module.exports = {
  onlineUsers,
  pendingOfflineTimers,
  markUserOnline,
  markUserOffline,
  getOnlineUserIds,
  getOnlineUserIdsAsync,
  clearPendingOfflineTimer,
  SOCKET_OFFLINE_GRACE_MS,
};
