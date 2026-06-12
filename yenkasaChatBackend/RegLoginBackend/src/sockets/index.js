const mongoose = require('mongoose');

const User = require('../../models/user.model');
const ChatRoom = require('../../models/chatroom.model');
const LiveStream = require('../../models/LiveStream');
const onlineService = require('../services/online/online.service');
const registerLivestreamEvents = require('../services/livestream/livestream.socket');

const chatLaughReactionCooldowns = new Map();
const CHAT_LAUGH_REACTION_COOLDOWN_MS = Number(
  process.env.CHAT_LAUGH_REACTION_COOLDOWN_MS || 2500,
);

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`💡 Client connected: ${socket.id}`);
    socket.data.liveStreams = new Set();
    socket.data.hostLiveStreams = new Set();

    socket.on('userConnected', async (data) => {
      try {
        await onlineService.markUserOnline({
          io,
          User,
          socket,
          userId: data?.userId || data,
        });
      } catch (err) {
        console.error('❌ Error setting user online:', err.message);
      }
    });

    socket.on('userOnline', async (userId) => {
      try {
        await onlineService.markUserOnline({ io, User, socket, userId });
      } catch (err) {
        console.error('❌ Error setting user online:', err.message);
      }
    });

    socket.on('userOffline', async (userId) => {
      try {
        await onlineService.markUserOffline({
          io,
          User,
          socket,
          userId,
          immediate: true,
          reason: 'explicit_userOffline',
        });
      } catch (err) {
        console.error('❌ Error setting user offline:', err.message);
      }
    });

    socket.on('requestOnlineUsers', async () => {
      socket.emit('getOnlineUsers', await onlineService.getOnlineUserIdsAsync());
    });

    socket.on('joinChatRoom', async (payload) => {
      try {
        const normalizedRoomId = (payload?.roomId || payload)?.toString();
        const normalizedUserId = (socket.data.userId || payload?.userId)?.toString();
        if (!normalizedRoomId || !mongoose.Types.ObjectId.isValid(normalizedRoomId) || !normalizedUserId) {
          return;
        }

        const room = await ChatRoom.findOne({
          _id: normalizedRoomId,
          participants: normalizedUserId,
        })
          .select('_id')
          .lean();

        if (!room) return;
        socket.join(normalizedRoomId);
        console.log(`💬 Socket ${socket.id} joined chat room ${normalizedRoomId}`);
      } catch (err) {
        console.error('❌ Error joining chat room:', err.message);
      }
    });

    socket.on('leaveChatRoom', (roomId) => {
      const normalizedRoomId = roomId?.toString();
      if (!normalizedRoomId) return;
      socket.leave(normalizedRoomId);
    });

    socket.on('chat_laugh_reaction', async (payload = {}) => {
      try {
        const senderId = socket.data.userId?.toString();
        const roomId = (payload.conversationId || payload.roomId)?.toString();
        if (!senderId || !roomId || !mongoose.Types.ObjectId.isValid(roomId)) return;

        const cooldownKey = `${senderId}:${roomId}`;
        const now = Date.now();
        const lastSentAt = chatLaughReactionCooldowns.get(cooldownKey) || 0;
        if (now - lastSentAt < CHAT_LAUGH_REACTION_COOLDOWN_MS) return;
        chatLaughReactionCooldowns.set(cooldownKey, now);

        const room = await ChatRoom.findOne({
          _id: roomId,
          participants: senderId,
        })
          .select('_id participants')
          .lean();

        if (!room) return;
        const recipientUserRooms = (room.participants || [])
          .map((participantId) => participantId.toString())
          .filter((participantId) => participantId !== senderId);

        if (recipientUserRooms.length === 0) return;

        socket.to(recipientUserRooms).emit('chat_laugh_reaction', {
          senderId,
          receiverId: payload.receiverId?.toString?.() || '',
          conversationId: roomId,
          roomId,
          timestamp: now,
        });
      } catch (err) {
        console.error('❌ chat_laugh_reaction failed:', err.message);
      }
    });

    const livestreamHandlers = registerLivestreamEvents(io, socket, {
      mongoose,
      User,
      LiveStream,
    });

    socket.on('disconnect', async (reason) => {
      try {
        console.log(`🔥 Client disconnected: ${socket.id}. reason=${reason}`);

        await livestreamHandlers.cleanupDisconnectedSocket(reason);

        if (socket.data.userId) {
          await onlineService.markUserOffline({
            io,
            User,
            socket,
            userId: socket.data.userId,
            reason,
          });
          return;
        }

        for (const [userId, socketIds] of onlineService.onlineUsers.entries()) {
          if (socketIds.has(socket.id)) {
            await onlineService.markUserOffline({
              io,
              User,
              socket,
              userId,
              reason,
            });
            break;
          }
        }
      } catch (err) {
        console.error('❌ Error handling disconnect:', err.message);
      }
    });
  });
}

module.exports = registerSocketHandlers;
