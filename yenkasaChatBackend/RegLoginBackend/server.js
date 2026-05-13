// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require("socket.io");
const User = require('./models/user.model'); // ✅ Add this
const ChatRoom = require('./models/chatroom.model');
const LiveStream = require('./models/LiveStream');
const StoreProfile = require('./models/storeProfile.model');
// 🪙 Coins & Verification system
const CoinSupply = require('./models/coinSupply');
const CoinTransaction = require('./models/cointransaction.model');
const verificationRules = require('./config/verificationRules');
const seedCommunities = require('./seed/seedCommunities');
const commentRoutes = require('./routes/comments.routes');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { cloudinaryMediaResponseOptimizer } = require('./utils/cloudinaryMedia');





const app = express();

app.set('trust proxy', true);

app.use((req, res, next) => {
  if (req.hostname === "yenkasa.xyz") {
    return res.redirect(301, `https://www.yenkasa.xyz${req.originalUrl}`);
  }
  next();
});

const corsOptions = {
  origin(origin, callback) {
    callback(null, origin || true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(express.json({
  verify: (req, res, buf) => {
    const requestPath = String(req.originalUrl || '').split('?')[0];
    if (requestPath === '/triciabales-api/api/paystack/webhook') {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cloudinaryMediaResponseOptimizer);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

require('./store/yenkasa-store-server')(app);
require('./web/yenkasa-web-server')(app);








console.log("server.js: Starting application setup...");



// --- HTTP + Socket.IO Server ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ["websocket", "polling"],
});

// ✅ Make io globally accessible so routes (e.g. feed.routes.js) can emit events
global.io = io;


// ---------------------------------
// Middlewares
// ---------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
imgSrc: [
  "'self'",
  "data:",
  "blob:",
  "https://www.yenkasa.xyz",
  "https://res.cloudinary.com",
  "https://images.unsplash.com"
],
mediaSrc: [
  "'self'",
  "blob:",
  "https://www.yenkasa.xyz",
  "https://res.cloudinary.com"
]
      }
    }
  })
);


app.use(compression());
if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));
console.log("server.js: Core middlewares configured.");




// ---------------------------------
// ✨ SOCKET.IO ONLINE/OFFLINE TRACKING
// ---------------------------------
const onlineUsers = new Map();
const pendingOfflineTimers = new Map();
const SOCKET_OFFLINE_GRACE_MS = Number(process.env.SOCKET_OFFLINE_GRACE_MS || 600000);
const chatLaughReactionCooldowns = new Map();
const CHAT_LAUGH_REACTION_COOLDOWN_MS = Number(process.env.CHAT_LAUGH_REACTION_COOLDOWN_MS || 2500);
const liveHostDisconnectTimers = new Map();
const LIVE_HOST_DISCONNECT_GRACE_MS = Number(process.env.LIVESTREAM_HOST_DISCONNECT_GRACE_MS || 45000);

function getLiveRoom(streamId) {
  return `livestream_${streamId}`;
}

function getLegacyLiveRoom(streamId) {
  return `live:${streamId}`;
}

function emitToLiveRoom(streamId, eventName, payload) {
  io.to(getLiveRoom(streamId)).to(getLegacyLiveRoom(streamId)).emit(eventName, payload);
}

function joinLiveRooms(socket, streamId) {
  socket.join(getLiveRoom(streamId));
  socket.join(getLegacyLiveRoom(streamId));
}

function leaveLiveRooms(socket, streamId) {
  socket.leave(getLiveRoom(streamId));
  socket.leave(getLegacyLiveRoom(streamId));
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
    hostRole: stream.hostRole || '',
    maxDurationMinutes: stream.maxDurationMinutes ?? null,
    scheduledEndAt: stream.scheduledEndAt || null,
    hostJoinedAt: stream.hostJoinedAt || null,
    hostLastSeenAt: stream.hostLastSeenAt || null,
    startupExpiresAt: stream.startupExpiresAt || null,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt
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

async function endLiveStreamForHostDrop(streamId, socketId) {
  if (!mongoose.Types.ObjectId.isValid(streamId)) return;
  const stream = await LiveStream.findOneAndUpdate(
    {
      _id: streamId,
      isLive: true,
      lifecycleStatus: 'live',
      hostConnected: true,
      hostSocketId: socketId
    },
    {
      $set: {
        isLive: false,
        lifecycleStatus: 'ended',
        hostConnected: false,
        hostSocketId: '',
        endedAt: new Date(),
        endReason: 'host_disconnected',
        viewerCount: 0
      }
    },
    { new: true }
  );
  if (!stream) return;

  const endedEvent = {
    streamId,
    reason: 'host_disconnected'
  };
  emitToLiveRoom(streamId, 'livestream_ended', endedEvent);
  emitToLiveRoom(streamId, 'live_ended', endedEvent);
  io.emit('livestream_removed', endedEvent);
  io.emit('live_removed', endedEvent);
  console.log(`📺 Livestream ${streamId} ended after host socket ${socketId} disconnected.`);
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

io.on('connection', (socket) => {
  console.log(`💡 Client connected: ${socket.id}`);
  socket.data.liveStreams = new Set();
  socket.data.hostLiveStreams = new Set();

  const clearPendingOffline = (userId) => {
    const normalizedUserId = userId?.toString();
    if (!normalizedUserId) return;

    const pendingTimer = pendingOfflineTimers.get(normalizedUserId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingOfflineTimers.delete(normalizedUserId);
      console.log(`🟢 Cleared pending offline timer for ${normalizedUserId}`);
    }
  };

  const markUserOnline = async (userId) => {
    if (!userId) return;

    const normalizedUserId = userId.toString();
    clearPendingOffline(normalizedUserId);

    const socketIds = onlineUsers.get(normalizedUserId) || new Set();
    socketIds.add(socket.id);
    onlineUsers.set(normalizedUserId, socketIds);
    socket.data.userId = normalizedUserId;
    socket.join(normalizedUserId);

    console.log(`🟢 User ${normalizedUserId} is online (${socketIds.size} active socket(s))`);

    await User.findByIdAndUpdate(
      normalizedUserId,
      { online: true, lastSeen: new Date() },
      { new: true }
    );
    io.emit('getOnlineUsers', getOnlineUserIds());
    io.emit('userStatusChanged', {
      userId: normalizedUserId,
      isOnline: true,
      statusText: 'Online'
    });
  };

  const markUserOffline = async (userId, options = {}) => {
    if (!userId) return;

    const { immediate = false, reason = 'socket_disconnect' } = options;
    const normalizedUserId = userId.toString();
    const socketIds = onlineUsers.get(normalizedUserId);

    if (socketIds) {
      socketIds.delete(socket.id);
      if (socketIds.size > 0) {
        onlineUsers.set(normalizedUserId, socketIds);
        console.log(`🟡 Socket ${socket.id} left user ${normalizedUserId}; ${socketIds.size} socket(s) still active.`);
        io.emit('getOnlineUsers', getOnlineUserIds());
        return;
      }

      onlineUsers.set(normalizedUserId, socketIds);
    }

    clearPendingOffline(normalizedUserId);

    const finalizeOffline = async () => {
      const latestSocketIds = onlineUsers.get(normalizedUserId);
      if (latestSocketIds && latestSocketIds.size > 0) {
        console.log(`🟢 Offline skipped for ${normalizedUserId}; user reconnected.`);
        return;
      }

      console.log(`🔴 User ${normalizedUserId} went offline. reason=${reason}`);
      pendingOfflineTimers.delete(normalizedUserId);
      onlineUsers.delete(normalizedUserId);

      await User.findByIdAndUpdate(
        normalizedUserId,
        { online: false, lastSeen: new Date() },
        { new: true }
      );

      io.emit('getOnlineUsers', getOnlineUserIds());
      io.emit('userStatusChanged', {
        userId: normalizedUserId,
        isOnline: false,
        statusText: 'Offline'
      });
    };

    if (immediate) {
      await finalizeOffline();
      return;
    }

    console.log(`🟡 User ${normalizedUserId} has no active sockets. Waiting ${SOCKET_OFFLINE_GRACE_MS}ms before marking offline. reason=${reason}`);
    const timer = setTimeout(() => {
      finalizeOffline().catch((err) => {
        console.error(`❌ Error finalizing offline for ${normalizedUserId}:`, err.message);
      });
    }, SOCKET_OFFLINE_GRACE_MS);
    pendingOfflineTimers.set(normalizedUserId, timer);
    io.emit('getOnlineUsers', getOnlineUserIds());
  };

  // ✅ User connects
  socket.on('userConnected', async (data) => {
    try {
      await markUserOnline(data?.userId || data);
    } catch (err) {
      console.error('❌ Error setting user online:', err.message);
    }
  });

  socket.on('userOnline', async (userId) => {
    try {
      await markUserOnline(userId);
    } catch (err) {
      console.error('❌ Error setting user online:', err.message);
    }
  });

  socket.on('userOffline', async (userId) => {
    try {
      await markUserOffline(userId, { immediate: true, reason: 'explicit_userOffline' });
    } catch (err) {
      console.error('❌ Error setting user offline:', err.message);
    }
  });

  socket.on('requestOnlineUsers', () => {
    socket.emit('getOnlineUsers', getOnlineUserIds());
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
        participants: normalizedUserId
      }).select('_id').lean();

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
        participants: senderId
      }).select('_id participants').lean();

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
        timestamp: now
      });
    } catch (err) {
      console.error('❌ chat_laugh_reaction failed:', err.message);
    }
  });

  const updateLiveViewerCount = async (streamId, delta) => {
    if (!mongoose.Types.ObjectId.isValid(streamId)) return null;
    const stream = await LiveStream.findOneAndUpdate(
      {
        _id: streamId,
        isLive: true,
        lifecycleStatus: 'live',
        hostConnected: true
      },
      { $inc: { viewerCount: delta } },
      { new: true }
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
      viewerCount: stream.viewerCount
    };
    emitToLiveRoom(streamId, 'livestream_viewer_count', payload);
    emitToLiveRoom(streamId, 'live_viewer_count', payload);
    return stream;
  };

  const handleLiveHostReady = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      const userId = (socket.data.userId || payload.userId)?.toString();
      if (!streamId || !mongoose.Types.ObjectId.isValid(streamId) || !userId) return;

      const now = new Date();
      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId: userId,
        lifecycleStatus: { $in: ['starting', 'live'] }
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

      clearLiveHostDisconnectTimer(streamId);
      joinLiveRooms(socket, streamId);
      socket.data.hostLiveStreams.add(streamId);

      const startedEvent = { stream: serializeLiveStream(stream) };
      io.emit('livestream_started', startedEvent);
      io.emit('live_started', startedEvent);
      emitToLiveRoom(streamId, 'livestream_host_ready', {
        streamId,
        userId,
        username: stream.hostUsername,
        createdAt: now.toISOString()
      });
      console.log(`📺 Livestream host ready: ${streamId} socket=${socket.id}`);
    } catch (err) {
      console.error('❌ livestream_host_ready failed:', err.message);
    }
  };

  socket.on('livestream_host_ready', handleLiveHostReady);
  socket.on('live_host_ready', handleLiveHostReady);

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
          hostSocketId: socket.id
        },
        { $set: { hostLastSeenAt: new Date(), hostConnected: true } }
      );
    } catch (err) {
      console.error('❌ livestream_host_heartbeat failed:', err.message);
    }
  };

  socket.on('livestream_host_heartbeat', handleLiveHostHeartbeat);
  socket.on('live_host_heartbeat', handleLiveHostHeartbeat);

  const handleLiveJoin = async (payload = {}) => {
    try {
      const streamId = payload.streamId?.toString();
      if (!streamId || socket.data.liveStreams.has(streamId)) return;

      joinLiveRooms(socket, streamId);
      socket.data.liveStreams.add(streamId);
      const stream = await updateLiveViewerCount(streamId, 1);
      if (!stream) {
        leaveLiveRooms(socket, streamId);
        socket.data.liveStreams.delete(streamId);
        return;
      }

      const event = {
        streamId,
        userId: socket.data.userId || payload.userId || '',
        username: payload.username || 'Viewer',
        viewerCount: stream.viewerCount
      };
      emitToLiveRoom(streamId, 'livestream_join', event);
      emitToLiveRoom(streamId, 'live_join', event);
    } catch (err) {
      console.error('❌ live_join failed:', err.message);
    }
  };

  socket.on('livestream_join', handleLiveJoin);
  socket.on('live_join', handleLiveJoin);

  const handleLiveLeave = async (payload = {}) => {
    try {
      const streamId = (payload.streamId || payload)?.toString();
      if (!streamId || !socket.data.liveStreams.has(streamId)) return;
      const event = {
        streamId,
        userId: socket.data.userId || payload.userId || '',
        username: payload.username || 'Viewer',
        createdAt: new Date().toISOString()
      };
      emitToLiveRoom(streamId, 'livestream_leave', event);
      emitToLiveRoom(streamId, 'live_leave', event);
      socket.data.liveStreams.delete(streamId);
      leaveLiveRooms(socket, streamId);
      await updateLiveViewerCount(streamId, -1);
    } catch (err) {
      console.error('❌ live_leave failed:', err.message);
    }
  };

  socket.on('livestream_leave', handleLiveLeave);
  socket.on('live_leave', handleLiveLeave);

  const handleLiveComment = (payload = {}) => {
    const streamId = payload.streamId?.toString();
    const message = payload.message?.toString?.().trim();
    if (!streamId || !message) return;
    const event = {
      streamId,
      userId: socket.data.userId || payload.userId || '',
      username: payload.username || 'Viewer',
      avatar: payload.avatar || '',
      message: message.slice(0, 240),
      createdAt: new Date().toISOString()
    };
    emitToLiveRoom(streamId, 'livestream_comment', event);
    emitToLiveRoom(streamId, 'live_comment', event);
  };

  socket.on('livestream_comment', handleLiveComment);
  socket.on('live_comment', handleLiveComment);

  const handleLiveReaction = (payload = {}) => {
    const streamId = payload.streamId?.toString();
    if (!streamId) return;
    const event = {
      streamId,
      userId: socket.data.userId || payload.userId || '',
      username: payload.username || 'Viewer',
      reaction: payload.reaction || '🔥',
      type: payload.type || payload.reaction || '🔥',
      createdAt: new Date().toISOString()
    };
    emitToLiveRoom(streamId, 'livestream_reaction', event);
    emitToLiveRoom(streamId, 'live_reaction', event);
  };

  socket.on('livestream_reaction', handleLiveReaction);
  socket.on('live_reaction', handleLiveReaction);

  // ✅ User disconnects
  socket.on('disconnect', async (reason) => {
    try {
      console.log(`🔥 Client disconnected: ${socket.id}. reason=${reason}`);

      if (socket.data.hostLiveStreams?.size) {
        for (const streamId of Array.from(socket.data.hostLiveStreams)) {
          clearLiveHostDisconnectTimer(streamId);
          const timer = setTimeout(() => {
            liveHostDisconnectTimers.delete(streamId);
            endLiveStreamForHostDrop(streamId, socket.id).catch((err) => {
              console.error('❌ Error ending livestream after host disconnect:', err.message);
            });
          }, LIVE_HOST_DISCONNECT_GRACE_MS);
          liveHostDisconnectTimers.set(streamId, timer);
        }
        socket.data.hostLiveStreams.clear();
      }

      if (socket.data.liveStreams?.size) {
        await Promise.allSettled(
          Array.from(socket.data.liveStreams).map((streamId) => updateLiveViewerCount(streamId, -1))
        );
        socket.data.liveStreams.clear();
      }

      if (socket.data.userId) {
        await markUserOffline(socket.data.userId, { reason });
        return;
      }

      for (let [userId, socketIds] of onlineUsers.entries()) {
        if (socketIds.has(socket.id)) {
          await markUserOffline(userId, { reason });
          break;
        }
      }
    } catch (err) {
      console.error('❌ Error handling disconnect:', err.message);
    }
  });
});

// ---------------------------------
// API Route Mounting
// ---------------------------------
function safeMount(routePath, filePath) {
  try {
    app.use(routePath, require(filePath));
    console.log(`✅ Mounted ${filePath} at ${routePath}`);
  } catch (err) {
    console.error(`❌ Failed to mount ${filePath} at ${routePath}: ${err.message}`);
  }
}

console.log("server.js: Mounting API routes...");
safeMount('/api/auth', './routes/auth');
safeMount('/api/reset-password', './routes/changepwd.routes.js');
safeMount('/api/verify', './routes/verify');
safeMount('/api/account', './routes/account.routes');
safeMount('/api/users', './routes/user.routes');
safeMount('/api/user', './routes/conversationStreak.routes');
safeMount('/api/contacts', './routes/contacts.routes');
safeMount('/api/messages', './routes/messages.routes');
safeMount('/api/chatrooms', './routes/chatroom.routes');
safeMount('/api/groups', './routes/group.routes');
safeMount('/api/onesignal', './routes/onesignal');
safeMount('/api/profile', './routes/profile');
// ---------------------------------
// 🧩 New API Routes
// ---------------------------------
safeMount('/api/app-verification', './routes/appverification.routes');
safeMount('/api/coin-transactions', './routes/cointransaction.routes');
safeMount('/api/wallet', './routes/wallet.routes');
safeMount('/api/leaderboard', './routes/leaderboard.routes');
safeMount('/api/admin', './routes/adminPayout.routes');
safeMount('/api/comments', './routes/comments.routes');
safeMount('/api/feed', './routes/feed.routes');
safeMount('/api/search', './routes/search.routes');
safeMount('/api/communities', './routes/community.routes');
safeMount('/api/roles', './routes/roles.routes');
safeMount('/api/follow', './routes/follow.routes');
safeMount('/api/post-approval', './routes/postapproval.routes');
safeMount('/api/notifications', './routes/notifications.routes');
safeMount('/api/user-privacy', './routes/userPrivacy.routes');
safeMount('/api/metrics', './routes/metrics.routes');
safeMount('/api/live', './routes/live.routes');
safeMount('/api/livestream', './routes/livestream.routes');
safeMount('/api/ads', './routes/ads.routes');
safeMount('/api/email-verification', './routes/emailVerification.routes');
// 🔐 Account & data deletion
safeMount("/api", "./routes/accountDeletion.routes");

// 🛡️ Moderation actions
safeMount("/api", "./routes/moderation.routes");
// 🧩 Moderation WEB dashboard
safeMount("/", "./routes/moderation.page");








// 🧩 Handle Multer upload errors globally
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  } else if (err.message === "Unsupported file type") {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});


console.log("✅ Finished mounting API routes.");

// Add after all `app.use(...)` route mounts, before app.listen(...)
const listEndpoints = require('express-list-endpoints');
console.log('=== Registered endpoints ===');
console.log(listEndpoints(app));
console.log('=== End registered endpoints ===');

// ---------------------------------
// Health Check
// ---------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    env: process.env.NODE_ENV
  });
});

// ---------------------------------
// Serve Compliance / Policy Documents
// ---------------------------------
// ✅ Ensure correct MIME type for MP4 videos
app.use((req, res, next) => {
  if (req.path.endsWith('.mp4')) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
  }
  next();
});

// Generic function to serve static policy HTML files
function servePolicy(fileName) {
  return (req, res) => {
    res.sendFile(path.join(__dirname, 'public', fileName));
  };
}

app.get('/privacy-policy', servePolicy('privacy-policy.html'));
app.get('/privacy-policy.html', servePolicy('privacy-policy.html'));

app.get('/user-agreement', servePolicy('user-agreement.html'));
app.get('/user-agreement.html', servePolicy('user-agreement.html'));

app.get('/community-guidelines', servePolicy('community-guidelines.html'));
app.get('/community-guidelines.html', servePolicy('community-guidelines.html'));

app.get('/moderation-policy', servePolicy('moderation-policy.html'));
app.get('/moderation-policy.html', servePolicy('moderation-policy.html'));

app.get('/safety-policy', servePolicy('safety-policy.html'));
app.get('/safety-policy.html', servePolicy('safety-policy.html'));

app.get('/ads-disclosure', servePolicy('ads-disclosure.html'));
app.get('/ads-disclosure.html', servePolicy('ads-disclosure.html'));

app.get('/delete-data', servePolicy('delete-data.html'));
app.get('/delete-data.html', servePolicy('delete-data.html'));
app.get('/data-deletion', servePolicy('delete-data.html'));
app.get('/data-deletion.html', servePolicy('delete-data.html'));
app.get('/account-data-deletion', servePolicy('delete-data.html'));
app.get('/account-data-deletion.html', servePolicy('delete-data.html'));


// Google Play App-Ads.txt
app.get('/app-ads.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app-ads.txt'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'images', 'yc.png'));
});

// ---------------------------------
// Static Files
// ---------------------------------
app.get('/.well-known/assetlinks.json', (req, res) => {
  const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(err.code === 'ENOENT' ? 404 : 500).send(err.message);
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(data);
  });
});

app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/reset-password', 'index.html'));
});



//Post routes

const postRoutes = require('./routes/post.routes');
app.use('/api/posts', postRoutes);


const socialRoutes = require('./routes/social.routes');
app.use('/api/social', socialRoutes);

const viewRoutes = require('./routes/view.routes');
app.use('/api/views', viewRoutes);


// ---------------------------------
// Account Deletion Page
// ---------------------------------
const deleteAccountPage = require("./routes/deleteAccount.page");
app.use(deleteAccountPage);




// ---------------------------------
// Error Handling
// ---------------------------------
app.use((req, res, next) => {
  if (
    req.originalUrl.startsWith("/api/") &&
    !req.originalUrl.startsWith("/api/blog/")
  ) {
    return res.status(404).json({ error: "API route not found" });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});


// ---------------------------------
// Clean Store URLs
// ---------------------------------
const STORE_PUBLIC_DIR = path.join(__dirname, 'public', 'triciabales_frontend');
const STORE_LANDING_DIR = path.join(STORE_PUBLIC_DIR, 'landingFile');
const STORE_LOGO_PATH = path.join(STORE_PUBLIC_DIR, 'images', 'YenkasaStoreLogo.png');
const BLOG_DIR = path.join(__dirname, 'public', 'blog');
const BLOG_POSTS_DIR = path.join(BLOG_DIR, 'posts');
const BLOG_ENGAGEMENT_DIR = path.join(__dirname, 'data');
const BLOG_ENGAGEMENT_PATH = path.join(BLOG_ENGAGEMENT_DIR, 'blog-engagement.json');

function isValidBlogSlug(slug) {
  return /^[a-z0-9-]+$/i.test(String(slug || ''));
}

function readBlogEngagement() {
  try {
    if (!fs.existsSync(BLOG_ENGAGEMENT_PATH)) return {};
    return JSON.parse(fs.readFileSync(BLOG_ENGAGEMENT_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to read blog engagement data:', err.message);
    return {};
  }
}

function writeBlogEngagement(data) {
  fs.mkdirSync(BLOG_ENGAGEMENT_DIR, { recursive: true });
  fs.writeFileSync(BLOG_ENGAGEMENT_PATH, JSON.stringify(data, null, 2));
}

function getBlogEngagementRecord(slug) {
  const data = readBlogEngagement();
  if (!data[slug]) {
    data[slug] = { slug, views: 0, likes: 0 };
  }
  return { data, record: data[slug] };
}
const STORE_PAGE_ALIASES = new Map(Object.entries({
  '': 'index.html',
  'home': 'index.html',
  'cart': 'cart.html',
  'orders': 'my-orders.html',
  'my-orders': 'my-orders.html',
  'register': 'register.html',
  'buyer-login': 'buyer-login.html',
  'seller-login': 'seller-login.html',
  'seller-dashboard': 'seller-dashboard.html',
  'notifications': 'notifications.html',
  'admin-login': 'login.html',
  'admin': 'admin.html',
  'super-admin': 'super-admin.html',
  'dashboard': 'dashboard.html',
  'address': 'address.html',
  'delivery': 'delivery.html',
  'payment': 'payment.html',
  'thank-you': 'thank-you.html',
  'forgot-password': 'forgot-password.html',
  'reset-password': 'reset-password.html',
  'verify-email': 'verify-email.html',
  'paystack-callback': 'paystack-callback.html',
  'privacy': 'privacy.html'
}));
const STORE_FILE_TO_ALIAS = new Map(Object.entries({
  'index.html': '',
  'cart.html': 'cart',
  'my-orders.html': 'orders',
  'register.html': 'register',
  'buyer-login.html': 'buyer-login',
  'seller-login.html': 'seller-login',
  'seller-dashboard.html': 'seller-dashboard',
  'notifications.html': 'notifications',
  'login.html': 'admin-login',
  'admin.html': 'admin',
  'super-admin.html': 'super-admin',
  'dashboard.html': 'dashboard',
  'address.html': 'address',
  'delivery.html': 'delivery',
  'payment.html': 'payment',
  'thank-you.html': 'thank-you',
  'forgot-password.html': 'forgot-password',
  'reset-password.html': 'reset-password',
  'verify-email.html': 'verify-email',
  'paystack-callback.html': 'paystack-callback',
  'privacy.html': 'privacy'
}));

function getQueryString(req) {
  const index = req.originalUrl.indexOf('?');
  return index === -1 ? '' : req.originalUrl.slice(index);
}

function storePathForAlias(alias) {
  return alias ? `/store/${alias}` : '/store';
}

function serveStorePage(fileName) {
  return (req, res) => {
    res.sendFile(path.join(STORE_LANDING_DIR, fileName));
  };
}

function isGitLfsPointer(buffer) {
  return buffer
    .slice(0, 48)
    .toString('utf8')
    .startsWith('version https://git-lfs.github.com/spec/v1');
}

async function loadStoreLogoBuffer() {
  const localLogo = await fs.promises.readFile(STORE_LOGO_PATH);

  if (!isGitLfsPointer(localLogo)) {
    return localLogo;
  }

  const remoteLogoUrl = process.env.YENKASA_STORE_LOGO_URL || process.env.STORE_LOGO_URL;

  if (!remoteLogoUrl) {
    throw new Error(
      'Yenkasa Store logo file is a Git LFS pointer. Deploy the real PNG or set YENKASA_STORE_LOGO_URL.'
    );
  }

  const response = await axios.get(remoteLogoUrl, {
    responseType: 'arraybuffer',
    timeout: 10000
  });
  const remoteLogo = Buffer.from(response.data);

  if (isGitLfsPointer(remoteLogo)) {
    throw new Error('Remote Yenkasa Store logo URL returned a Git LFS pointer instead of a PNG.');
  }

  return remoteLogo;
}

app.get([
  '/store/assets/images/YenkasaStoreLogo.png',
  '/store-assets/images/YenkasaStoreLogo.png',
  '/triciabales_frontend/images/YenkasaStoreLogo.png'
], async (req, res, next) => {
  try {
    const profile = await StoreProfile.findOne({ key: 'default' }).lean();
    const configuredLogoUrl = profile?.logoUrl || '';

    if (
      configuredLogoUrl &&
      !configuredLogoUrl.includes('/store/assets/images/YenkasaStoreLogo.png') &&
      !configuredLogoUrl.includes('/triciabales_frontend/images/YenkasaStoreLogo.png')
    ) {
      return res.redirect(302, configuredLogoUrl);
    }

    const logo = await loadStoreLogoBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', logo.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(logo);
  } catch (err) {
    console.error('Yenkasa Store logo error:', err.message);
    next(err);
  }
});

app.use('/store/assets', express.static(STORE_PUBLIC_DIR));
app.use('/store-assets', express.static(STORE_PUBLIC_DIR));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/store', serveStorePage('index.html'));
app.get('/privacy', serveStorePage('privacy.html'));
app.get('/store/paystack/callback', serveStorePage('paystack-callback.html'));
app.get('/store/:page', (req, res, next) => {
  const fileName = STORE_PAGE_ALIASES.get(req.params.page);
  if (!fileName) return next();
  res.sendFile(path.join(STORE_LANDING_DIR, fileName));
});

app.get('/triciabales_frontend/landingFile', (req, res) => {
  res.redirect(301, `/store${getQueryString(req)}`);
});
app.get('/triciabales_frontend/landingFile/', (req, res) => {
  res.redirect(301, `/store${getQueryString(req)}`);
});
app.get('/triciabales_frontend/landingFile/:page', (req, res, next) => {
  const page = req.params.page;
  if (!page.endsWith('.html')) {
    const fileName = STORE_PAGE_ALIASES.get(page);
    if (!fileName) return next();
    return res.sendFile(path.join(STORE_LANDING_DIR, fileName));
  }

  const alias = STORE_FILE_TO_ALIAS.get(page);
  if (!alias && page !== 'index.html') return next();
  res.redirect(301, `${storePathForAlias(alias)}${getQueryString(req)}`);
});

app.get('/blog', (req, res) => {
  res.sendFile(path.join(BLOG_DIR, 'index.html'));
});

app.get('/api/blog/:slug/views', (req, res) => {
  const slug = String(req.params.slug || '');
  if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

  const { record } = getBlogEngagementRecord(slug);
  res.json({ slug, views: record.views || 0 });
});

app.post('/api/blog/:slug/view', (req, res) => {
  const slug = String(req.params.slug || '');
  if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

  const { data, record } = getBlogEngagementRecord(slug);
  record.views = Number(record.views || 0) + 1;
  writeBlogEngagement(data);
  res.json({ slug, views: record.views });
});

app.get('/api/blog/:slug/likes', (req, res) => {
  const slug = String(req.params.slug || '');
  if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

  const { record } = getBlogEngagementRecord(slug);
  res.json({ slug, likes: record.likes || 0 });
});

app.post('/api/blog/:slug/like', (req, res) => {
  const slug = String(req.params.slug || '');
  if (!isValidBlogSlug(slug)) return res.status(400).json({ message: 'Invalid blog slug' });

  const { data, record } = getBlogEngagementRecord(slug);
  record.likes = Number(record.likes || 0) + 1;
  writeBlogEngagement(data);
  res.json({ slug, likes: record.likes });
});

app.get('/blog/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '');
  if (!isValidBlogSlug(slug)) return next();

  const filePath = path.join(BLOG_POSTS_DIR, `${slug}.html`);
  res.sendFile(filePath, err => {
    if (err) next();
  });
});

app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public.");

app.get('/download-app', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'yenkasa.0.3.1.apk');

  res.download(apkPath, 'Yenkasa-0.3.1.apk', (err) => {
    if (err) {
      console.error('APK download failed:', err.message);
      if (!res.headersSent) {
        res.status(404).send('APK file not found');
      }
    }
  });
});

// ---------------------------------
// MongoDB Connection + Server Start
// ---------------------------------
console.log("server.js: Connecting to MongoDB...");
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully.');

  // ✅ Seed permissions AFTER DB connection
  const Permission = require('./models/permissions.model');

Permission.seedDefaults()
  .then(() => {
    console.log('✅ Permissions seeded');
  })
  .catch(console.error);

  // 🕒 Start the daily verification scheduler
require('./services/verificationScheduler');
require('./services/ykcMonthlyReset');
console.log('🕒 Verification scheduler initialized and running daily checks.');



  const PORT = process.env.PORT || 8080;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`🔌 Socket.IO is attached and listening.`);
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});
