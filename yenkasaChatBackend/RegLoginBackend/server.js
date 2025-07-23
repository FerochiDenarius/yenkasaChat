// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();

// ✅ Middleware
app.use(express.json());

// ✅ Routes - OneSignal route for storing player IDs
const oneSignalRoutes = require('./routes/onesignal');
app.use('/api/onesignal', oneSignalRoutes);

// ✅ Import and register all route modules
try {
  const authRoutes = require('./routes/auth');
  const contactRoutes = require('./routes/contacts.routes');
  const messageRoutes = require('./routes/messages.routes');
  const chatroomRoutes = require('./routes/chatroom.routes');
  const verifyRoutes = require('./routes/verify');
  const userRoutes = require('./routes/user.routes');
  const notificationRoutes = require('./routes/notifications.route');

  app.use('/api/auth', authRoutes);
  console.log('✅ Mounted /api/auth');

  app.use('/api/contacts', contactRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/chatrooms', chatroomRoutes);
  app.use('/api/verify', verifyRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);

  console.log("✅ All route modules loaded and registered");
} catch (err) {
  console.error('❌ Failed to load one or more route modules:', err.message);
}

// ✅ Always-on test/debug route (moved out of NODE_ENV check)
app.get('/api/auth/ping', (req, res) => {
  res.json({ message: '✅ Auth route is working!' });
});

// ✅ Catch-all route to debug broken or missing endpoints
app.all('*', (req, res) => {
  res.status(404).json({
    message: `❌ Route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Check your route path and HTTP method.'
  });
});

// ✅ MongoDB connection and server start
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,         // ✅ still supported by Mongoose (harmless)
  useUnifiedTopology: true       // ✅ same here
})
.then(() => {
  console.log('✅ MongoDB connected');

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});
