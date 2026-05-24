function emitToUserRooms(userId, eventName, payload) {
  if (!global.io || !userId) return false;

  const normalizedUserId = String(userId);
  global.io.to(normalizedUserId).emit(eventName, payload);
  global.io.to(`user:${normalizedUserId}`).emit(eventName, payload);
  return true;
}

function emitMemoryProfileUpdated(userId, payload = {}) {
  return emitToUserRooms(userId, 'yme:memory_profile_updated', payload);
}

module.exports = {
  emitMemoryProfileUpdated,
};
