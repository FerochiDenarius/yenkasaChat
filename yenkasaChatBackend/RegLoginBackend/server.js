// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs'); // ✅ required for secret file check

const app = express();

// ✅ OneSignal route for saving player IDs
const oneSignalRoutes = require('./routes/onesignal');
app.use('/api/onesignal', oneSignalRoutes);

// ✅ Middleware
app.use(express.json());

// ✅ Import and register route modules
try {
  const authRoutes = require('./routes/auth');
  const contactRoutes = require('./routes/contacts.routes');
  const messageRoutes = require('./routes/messages.routes');
  const chatroomRoutes = require('./routes/chatroom.routes');
  const verifyRoutes = require('./routes/verify');
  const userRoutes = require('./routes/user.routes');

  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/chatrooms', chatroomRoutes);
  app.use('/api/verify', verifyRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', require('./routes/notifications.route'));

  console.log("✅ All route modules loaded and registered");
} catch (err) {
  console.error('❌ Failed to load one or more route modules:', err.message);
}

// ✅ Dev-only test/debug routes
if (process.env.NODE_ENV === 'development') {
  app.get('/cloudinary-test', (req, res) => {
    res.json({
      name: process.env.CLOUDINARY_CLOUD_NAME,
      key: process.env.CLOUDINARY_API_KEY,
      secret: process.env.CLOUDINARY_API_SECRET ? '✅ present' : '❌ missing',
    });
  });
} else {
  console.log('🔐 Test routes disabled in production');
}

// ✅ MongoDB Connection + Server Start
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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
