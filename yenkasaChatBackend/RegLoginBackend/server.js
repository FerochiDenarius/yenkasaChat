// server.js - FIXED & COMPLETE
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

// ✅ Initialize Express App
const app = express();
console.log("🚀 Starting Yenkasa Backend Server...");

// ✅ Create HTTP Server for Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// ---------------------------------
// Core Middlewares
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

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}
console.log("✅ Core middlewares configured");

// ---------------------------------
// Socket.IO Online/Offline Tracking
// ---------------------------------
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`💡 Socket connected: ${socket.id}`);

  socket.on('userConnected', async (data) => {
    try {
      const { userId } = data;
      if (!userId) return;

      const User = require('./models/user.model');
      console.log(`🟢 User ${userId} is online`);
      onlineUsers.set(userId, socket.id);

      await User.findByIdAndUpdate(userId, { 
        online: true,
        lastSeen: new Date() 
      }, { new: true });

      io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
    } catch (err) {
      console.error('❌ Error setting user online:', err.message);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const User = require('./models/user.model');
      console.log(`🔥 Socket disconnected: ${socket.id}`);

      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          console.log(`🔴 User ${userId} went offline`);
          onlineUsers.delete(userId);

          await User.findByIdAndUpdate(userId, {
            online: false,
            lastSeen: new Date()
          }, { new: true });
          break;
        }
      }

      io.emit('getOnlineUsers', Array.from(onlineUsers.keys()));
    } catch (err) {
      console.error('❌ Error handling disconnect:', err.message);
    }
  });
});

// Make io accessible to routes
app.set('io', io);

// ---------------------------------
// Safe Route Mounting Function
// ---------------------------------
function safeMount(routePath, filePath, routeName = '') {
  try {
    const routeHandler = require(filePath);
    app.use(routePath, routeHandler);
    console.log(`✅ Mounted ${routeName || filePath} at ${routePath}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to mount ${routeName || filePath} at ${routePath}:`, err.message);
    return false;
  }
}

// ---------------------------------
// Health Check (Early)
// ---------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ---------------------------------
// API Routes - Core System
// ---------------------------------
console.log("📡 Mounting API routes...");

// Auth & Account Management
safeMount('/api/auth', './routes/auth', 'Authentication');
safeMount('/api/reset-password', './routes/changepwd.routes.js', 'Password Reset');
safeMount('/api/verify', './routes/verify', 'Verification');
safeMount('/api/account', './routes/account.routes', 'Account Management');
safeMount('/api/profile', './routes/profile', 'Profile');

// Users & Social
safeMount('/api/users', './routes/user.routes', 'Users');
safeMount('/api/social', './routes/social.routes', 'Social (Follow)');

// Messaging
safeMount('/api/contacts', './routes/contacts.routes', 'Contacts');
safeMount('/api/messages', './routes/messages.routes', 'Messages');
safeMount('/api/chatrooms', './routes/chatroom.routes', 'Chat Rooms');

// Posts & Comments
safeMount('/api/posts', './routes/posts', 'Posts');
safeMount('/api/comments', './routes/comment.routes', 'Comments');

// Communities
safeMount('/api/communities', './routes/community.routes', 'Communities');

// Coins System
safeMount('/api/coins', './routes/coins', 'Coins');

// App Verification (6-Phase System)
safeMount('/api/app-verification', './routes/appverification.routes', 'App Verification');

// Notifications
safeMount('/api/onesignal', './routes/onesignal', 'OneSignal');
safeMount('/api/notifications', './routes/notifications.route', 'Notifications');

const feedRoutes = require("./routes/feed.routes");
app.use("/api/feed", feedRoutes);


console.log("✅ All API routes mounted");

// ---------------------------------
// List All Endpoints (Development)
// ---------------------------------
if (process.env.NODE_ENV !== 'production') {
  try {
    const listEndpoints = require('express-list-endpoints');
    console.log('\n📋 Registered Endpoints:');
    const endpoints = listEndpoints(app);
    endpoints.forEach(endpoint => {
      console.log(`   ${endpoint.methods.join(',')} ${endpoint.path}`);
    });
    console.log('');
  } catch (err) {
    console.log('⚠️  express-list-endpoints not installed (optional)');
  }
}

// ---------------------------------
// Static Files & Public Routes
// ---------------------------------
console.log("📁 Configuring static file serving...");

// Android Asset Links
app.get('/.well-known/assetlinks.json', (req, res) => {
  const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Asset links error:', err.message);
      return res.status(err.code === 'ENOENT' ? 404 : 500).json({ 
        error: 'Asset links not found' 
      });
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(data);
  });
});

// Password Reset Page
app.use('/reset-password', express.static(path.join(__dirname, 'public/reset-password')));
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/reset-password', 'index.html'));
});

// Terms & User Agreement
app.get('/terms', (req, res) => {
  const termsPath = path.join(__dirname, 'public', 'user_agreement.html');
  if (fs.existsSync(termsPath)) {
    res.sendFile(termsPath);
  } else {
    res.status(404).send('Terms of service page not found');
  }
});

// Serve public directory
app.use(express.static(path.join(__dirname, 'public')));
console.log("✅ Static file serving configured");

// ---------------------------------
// 404 Handler for API Routes
// ---------------------------------
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: "API endpoint not found",
    path: req.originalUrl,
    method: req.method
  });
});

// ---------------------------------
// Global Error Handler
// ---------------------------------
app.use((err, req, res, next) => {
  console.error("🔥 Global error handler:", err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      details: err.message 
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      error: 'Invalid ID format',
      details: err.message 
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'Invalid token',
      details: err.message 
    });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ---------------------------------
// MongoDB Connection + Server Start
// ---------------------------------
async function startServer() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
    
    // ---------------------------------
    // Seed Communities (if needed)
    // ---------------------------------
    try {
      const seedCommunities = require('./seed/seedCommunities');
      await seedCommunities();
      console.log('✅ Communities seeded (if needed)');
    } catch (err) {
      console.log('⚠️  Community seeding skipped:', err.message);
    }
    
    // ---------------------------------
    // Start Verification Scheduler (Optional)
    // ---------------------------------
    try {
      require('./services/verificationScheduler');
      console.log('🕒 Verification scheduler initialized');
    } catch (err) {
      console.log('⚠️  Verification scheduler not found (optional)');
    }
    
    // ---------------------------------
    // Start HTTP Server
    // ---------------------------------
    const PORT = process.env.PORT || 8080;
    const HOST = process.env.HOST || '0.0.0.0';
    
    server.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 YENKASA BACKEND SERVER STARTED');
      console.log('='.repeat(50));
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Server: http://${HOST}:${PORT}`);
      console.log(`🔌 Socket.IO: Active`);
      console.log(`💾 MongoDB: Connected`);
      console.log('='.repeat(50));
      console.log('\n✨ Features Available:');
      console.log('   ✅ Dual Verification (Email/Phone + App)');
      console.log('   ✅ 6-Phase Verification System');
      console.log('   ✅ Ghana Communities (34 total)');
      console.log('   ✅ Posts, Comments, Likes');
      console.log('   ✅ Yenkasa Coins Rewards');
      console.log('   ✅ Follow System');
      console.log('   ✅ Real-time Chat (Socket.IO)');
      console.log('   ✅ Online/Offline Tracking');
      console.log('\n📖 API Documentation: http://localhost:' + PORT + '/health');
      console.log('');
    });
    
  } catch (err) {
    console.error('❌ Server startup failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// ---------------------------------
// Graceful Shutdown
// ---------------------------------
process.on('SIGTERM', async () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    await mongoose.connection.close(false);
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    await mongoose.connection.close(false);
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// ---------------------------------
// Start the Server
// ---------------------------------
startServer();