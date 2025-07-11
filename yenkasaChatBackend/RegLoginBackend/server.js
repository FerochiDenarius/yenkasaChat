// ✅ Import and register routes
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

// 🔒 Dev-only test endpoints
if (process.env.NODE_ENV !== 'production') {
  app.get('/cloudinary-test', (req, res) => {
    res.json({
      name: process.env.CLOUDINARY_CLOUD_NAME,
      key: process.env.CLOUDINARY_API_KEY,
      secret: process.env.CLOUDINARY_API_SECRET ? '✅ present' : '❌ missing'
    });
  });

  app.get('/firebase-test', async (req, res) => {
    try {
      const token = await admin.app().options.credential.getAccessToken();
      res.json({ status: "✅ Firebase working", token });
    } catch (err) {
      console.error("❌ Firebase test failed", err);
      res.status(500).json({ error: "Firebase not working", details: err.message });
    }
  });
} else {
  console.log('🔐 Test routes (/firebase-test, /cloudinary-test) are disabled in production');
}

// ✅ MongoDB + server startup
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
