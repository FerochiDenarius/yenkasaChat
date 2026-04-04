// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require("socket.io");
const User = require('./models/user.model'); // ✅ Add this
// 🪙 Coins & Verification system
const CoinSupply = require('./models/coinSupply');
const CoinTransaction = require('./models/cointransaction.model');
const verificationRules = require('./config/verificationRules');
const seedCommunities = require('./seed/seedCommunities');
const commentRoutes = require('./routes/comments.routes');
const multer = require("multer");
const { createProxyMiddleware } = require('http-proxy-middleware');





const app = express();
console.log("server.js: Starting application setup...");



// --- HTTP + Socket.IO Server ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
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
        imgSrc: ["'self'", "data:", "http://134.209.182.39:8080"],
        mediaSrc: ["'self'", "http://134.209.182.39:8080"],
        connectSrc: ["'self'", "http://134.209.182.39:8080"]
      }
    }
  })
);
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));
console.log("server.js: Core middlewares configured.");


//my wifes site 
app.use(
  '/triciabales-api',
  createProxyMiddleware({
    target: 'http://134.209.182.39:8080',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
      '^/triciabales-api': ''
    },
    proxyTimeout: 30000,
    timeout: 30000,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log('Proxying:', req.method, req.originalUrl, '->', proxyReq.path);
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(500).json({ error: err.message });
    }
  })
);

// ---------------------------------
// ✨ SOCKET.IO ONLINE/OFFLINE TRACKING
// ---------------------------------
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`💡 Client connected: ${socket.id}`);

  // ✅ User connects
  socket.on('userConnected', async (data) => {
    try {
      const { userId } = data;
      if (!userId) return;

      console.log(`🟢 User ${userId} is online`);
      onlineUsers.set(userId, socket.id);

      // Update MongoDB
      await User.findByIdAndUpdate(userId, { online: true }, { new: true });

      // Notify all clients of updated online users
      io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
    } catch (err) {
      console.error('❌ Error setting user online:', err.message);
    }
  });

  // ✅ User disconnects
  socket.on('disconnect', async () => {
    try {
      console.log(`🔥 Client disconnected: ${socket.id}`);

      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          console.log(`🔴 User ${userId} went offline.`);
          onlineUsers.delete(userId);

          await User.findByIdAndUpdate(
            userId,
            { online: false, lastSeen: new Date() },
            { new: true }
          );
          break;
        }
      }

      // Broadcast updated list
      io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
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
safeMount('/api/contacts', './routes/contacts.routes');
safeMount('/api/messages', './routes/messages.routes');
safeMount('/api/chatrooms', './routes/chatroom.routes');
safeMount('/api/onesignal', './routes/onesignal');
safeMount('/api/profile', './routes/profile');
// ---------------------------------
// 🧩 New API Routes
// ---------------------------------
safeMount('/api/app-verification', './routes/appverification.routes');
safeMount('/api/coin-transactions', './routes/cointransaction.routes');
safeMount('/api/comments', './routes/comments.routes');
safeMount('/api/feed', './routes/feed.routes');
safeMount('/api/communities', './routes/community.routes');
safeMount('/api/roles', './routes/roles.routes');
safeMount('/api/follow', './routes/follow.routes');
safeMount('/api/post-approval', './routes/postapproval.routes');
safeMount('/api/notifications', './routes/notifications.routes');
safeMount('/api/user-privacy', './routes/userPrivacy.routes');
safeMount('/api/metrics', './routes/metrics.routes');
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


// Google Play App-Ads.txt
app.get('/app-ads.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app-ads.txt'));
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
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public.");

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

  // 🕒 Start the daily verification scheduler
require('./services/verificationScheduler');
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
