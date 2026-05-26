const onlineUsers = new Map();
const pendingOfflineTimers = new Map();
const SOCKET_OFFLINE_GRACE_MS = Number(process.env.SOCKET_OFFLINE_GRACE_MS || 600000);
const { createLogger } = require('../../yme/observability/logger');

const logger = createLogger('socket.online', {
  sourceModule: 'socket.online',
});

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

function clearPendingOfflineTimer(userId) {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return;

  const pendingTimer = pendingOfflineTimers.get(normalizedUserId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingOfflineTimers.delete(normalizedUserId);
    logger.info('Cleared pending offline timer.', {
      userId: normalizedUserId,
    });
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

  logger.info('User marked online.', {
    userId: normalizedUserId,
    data: {
      socketId: socket.id,
      activeSocketCount: socketIds.size,
    },
  });

  await User.findByIdAndUpdate(normalizedUserId, { online: true, lastSeen: new Date() }, { new: true });
  io.emit('getOnlineUsers', getOnlineUserIds());
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

  if (socketIds) {
    socketIds.delete(socket.id);
    if (socketIds.size > 0) {
      onlineUsers.set(normalizedUserId, socketIds);
      logger.info('Socket disconnected but user remains online on other sockets.', {
        userId: normalizedUserId,
        data: {
          socketId: socket.id,
          activeSocketCount: socketIds.size,
        },
      });
      io.emit('getOnlineUsers', getOnlineUserIds());
      return;
    }

    onlineUsers.set(normalizedUserId, socketIds);
  }

  clearPendingOfflineTimer(normalizedUserId);

  const finalizeOffline = async () => {
    const latestSocketIds = onlineUsers.get(normalizedUserId);
    if (latestSocketIds && latestSocketIds.size > 0) {
      logger.info('Offline transition skipped because the user reconnected.', {
        userId: normalizedUserId,
      });
      return;
    }

    logger.info('User marked offline.', {
      userId: normalizedUserId,
      data: {
        reason,
      },
    });
    pendingOfflineTimers.delete(normalizedUserId);
    onlineUsers.delete(normalizedUserId);

    await User.findByIdAndUpdate(normalizedUserId, { online: false, lastSeen: new Date() }, { new: true });

    io.emit('getOnlineUsers', getOnlineUserIds());
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

  logger.info('Scheduling offline transition after grace period.', {
    userId: normalizedUserId,
    data: {
      reason,
      graceMs: SOCKET_OFFLINE_GRACE_MS,
    },
  });
  const timer = setTimeout(() => {
    finalizeOffline().catch((err) => {
      logger.error('Failed to finalize offline transition.', {
        userId: normalizedUserId,
        error: err,
        data: {
          reason,
        },
      });
    });
  }, SOCKET_OFFLINE_GRACE_MS);
  pendingOfflineTimers.set(normalizedUserId, timer);
  io.emit('getOnlineUsers', getOnlineUserIds());
}

module.exports = {
  onlineUsers,
  pendingOfflineTimers,
  markUserOnline,
  markUserOffline,
  getOnlineUserIds,
  clearPendingOfflineTimer,
  SOCKET_OFFLINE_GRACE_MS,
};
