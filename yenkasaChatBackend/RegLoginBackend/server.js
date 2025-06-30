// ✅ Load environment variables FIRST
require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// ✅ Middleware
app.use(express.json());

// ✅ Import routes safely
try {
  const authRoutes = require('./routes/auth');
  console.log("✅ Auth route file loaded");

  const contactRoutes = require('./routes/contacts.routes');
  const messageRoutes = require('./routes/messages.routes');
  const chatroomRoutes = require('./routes/chatroom.routes');
  const verifyRoutes = require('./routes/verify');
  const userRoutes = require('./routes/user.routes');

  // ✅ Register route endpoints
  app.use('/api/auth', authRoutes);
  console.log("✅ /api/auth routes registered");

  app.use('/api/contacts', contactRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/chatrooms', chatroomRoutes);
  app.use('/api/verify', verifyRoutes);
  app.use('/api/users', userRoutes);
} catch (err) {
  console.error('❌ Failed to load one or more route modules:', err.message);
}

// ✅ Cloudinary ENV test endpoint (for debug only — disable in prod)
app.get('/cloudinary-test', (req, res) => {
  res.json({
    name: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET ? '✅ present' : '❌ missing'
  });
});

// ✅ MongoDB connection and server startup
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
