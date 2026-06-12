const { Server } = require('socket.io');
const registerSocketHandlers = require('../sockets');
const livestreamService = require('../services/livestream/livestream.service');
const { configureSocketRedisAdapter } = require('./socketRedisAdapter');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling'],
  });

  configureSocketRedisAdapter(io).catch((error) => {
    console.error('[Socket.IO] Redis adapter setup failed; continuing with in-memory adapter:', error.message);
  });

  global.io = io;
  livestreamService.configureLivestreamRealtime(io);
  global.emitToLiveRoomForStream = livestreamService.emitToLiveRoom;
  global.clearLiveParticipantsForStream = livestreamService.clearLiveParticipants;
  registerSocketHandlers(io);
  return io;
}

module.exports = initSocket;
