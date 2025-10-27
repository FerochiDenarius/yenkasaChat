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
const CoinTransaction = require('./models/coinTransaction');
const verificationEvaluator = require('./services/verificationEvaluator');
const verificationRules = require('./config/verificationRules');
const seedCommunities = require('./seed/seedCommunities');



const app = express();
console.log("server.js: Starting application setup...");

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ MongoDB connected');
  await seedCommunities(); // 🌱 run seeder here
}).catch(err => console.error('MongoDB connection error:', err));

// --- HTTP + Socket.IO Server ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// ---------------------------------
// Middlewares
// ---------------------------------
app.use(helmet());
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
safeMount('/api/notifications', './routes/notifications.route');
safeMount('/api/profile', './routes/profile');

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

app.use(express.static(path.join(__dirname, 'public')));
console.log("server.js: Static file serving configured for /public.");

// ✅ Serve User Agreement / Terms
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user_agreement.html'));
});

//Post routes

const postRoutes = require("./routes/posts");
app.use("/api/posts", postRoutes);

const socialRoutes = require('./routes/social.routes');
app.use('/api/social', socialRoutes);

const coinsRoutes = require('./routes/coins');
app.use('/coins', coinsRoutes);





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
