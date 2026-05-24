require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const initSocket = require('./config/socket');
const { startModerationWorkers } = require('./ai/workers/moderation.worker');

const Permission = require('../models/permissions.model');

const server = http.createServer(app);
initSocket(server);

async function startServer() {
  console.log('server.js: Connecting to MongoDB...');
  await connectDB();
  console.log('✅ MongoDB connected successfully.');

  await Permission.seedDefaults()
    .then(() => {
      console.log('✅ Permissions seeded');
    })
    .catch(console.error);

  require('../services/verificationScheduler');
  require('../services/ykcMonthlyReset');
  console.log('🕒 Verification scheduler initialized and running daily checks.');

  if (process.env.YENKASA_ENABLE_INLINE_MODERATION_WORKERS !== 'false') {
    const workerResult = await startModerationWorkers().catch((error) => {
      console.error('❌ Moderation workers failed to start:', error.message);
      return { started: false, reason: error.message };
    });
    console.log('🤖 Moderation worker bootstrap:', workerResult);
  }

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log('🔌 Socket.IO is attached and listening.');
  });
}

startServer().catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

module.exports = server;
