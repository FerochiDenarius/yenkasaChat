const onlineUsers = new Map();
const pendingOfflineTimers = new Map();
const SOCKET_OFFLINE_GRACE_MS = Number(process.env.SOCKET_OFFLINE_GRACE_MS || 600000);

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

  console.log(`🟢 User ${normalizedUserId} is online (${socketIds.size} active socket(s))`);

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
      console.log(
        `🟡 Socket ${socket.id} left user ${normalizedUserId}; ${socketIds.size} socket(s) still active.`,
      );
      io.emit('getOnlineUsers', getOnlineUserIds());
      return;
    }

    onlineUsers.set(normalizedUserId, socketIds);
  }

  clearPendingOfflineTimer(normalizedUserId);

  const finalizeOffline = async () => {
    const latestSocketIds = onlineUsers.get(normalizedUserId);
    if (latestSocketIds && latestSocketIds.size > 0) {
      console.log(`🟢 Offline skipped for ${normalizedUserId}; user reconnected.`);
      return;
    }

    console.log(`🔴 User ${normalizedUserId} went offline. reason=${reason}`);
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

  console.log(
    `🟡 User ${normalizedUserId} has no active sockets. Waiting ${SOCKET_OFFLINE_GRACE_MS}ms before marking offline. reason=${reason}`,
  );
  const timer = setTimeout(() => {
    finalizeOffline().catch((err) => {
      console.error(`❌ Error finalizing offline for ${normalizedUserId}:`, err.message);
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
