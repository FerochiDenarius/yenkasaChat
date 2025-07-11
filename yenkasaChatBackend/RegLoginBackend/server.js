// ✅ Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

const app = express();

// ✅ Firebase Admin SDK Setup
try {
  if (process.env.FIREBASE_CONFIG) {
    // ✅ Production (Render): Parse JSON string and fix \n issues in private_key
    const parsedConfig = JSON.parse(
      process.env.FIREBASE_CONFIG.replace(/\\n/g, '\n')
    );

    admin.initializeApp({
      credential: admin.credential.cert(parsedConfig),
    });

    console.log("✅ Firebase Admin initialized using FIREBASE_CONFIG (Render)");
  } else {
    // ✅ Local Development: Load local service account file
    const serviceAccount = require('./config/yenkasachat-480-firebase-adminsdk-fbsvc-ec4aa33dc5.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin initialized using local service account file");
  }
} catch (error) {
  console.error("❌ Firebase Admin failed to initialize:", error.message);
  process.exit(1);
}

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

  app.get('/firebase-test', async (req, res) => {
    try {
      const token = await admin.app().options.credential.getAccessToken();
      res.json({ status: "✅ Firebase working", token });
    } catch (err) {
      res.status(500).json({ error: "Firebase not working", details: err.message });
    }
  });

  app.get('/debug/firebase-env', (req, res) => {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_CONFIG.replace(/\\n/g, '\n'));
      res.json({ ok: true, parsed });
    } catch (err) {
      res.status(500).json({ error: 'Firebase config invalid', message: err.message });
    }
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
