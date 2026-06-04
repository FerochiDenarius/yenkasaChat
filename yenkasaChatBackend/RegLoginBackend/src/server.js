require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const initSocket = require('./config/socket');
const { startModerationWorkers } = require('./ai/workers/moderation.worker');
const { startIntelligenceEventRelay } = require('./intelligence/services/eventPublisher.service');
const { installServerIncidentOilBridge, publishServerIncident } = require('./intelligence/services/serverIncidentOil.service');
const { startYmeWorkers } = require('./yme/workers/yme.worker');

const Permission = require('../models/permissions.model');

const server = http.createServer(app);
initSocket(server);
const serverIncidentOilStatus = installServerIncidentOilBridge();

async function startServer() {
  console.log('🛢️ Server incident OIL bridge:', serverIncidentOilStatus);
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

  const relayStatus = startIntelligenceEventRelay();
  console.log('🛰️ Intelligence relay bootstrap:', relayStatus);

  if (process.env.YENKASA_ENABLE_INLINE_MODERATION_WORKERS !== 'false') {
    const workerResult = await startModerationWorkers().catch((error) => {
      console.error('❌ Moderation workers failed to start:', error.message);
      return { started: false, reason: error.message };
    });
    console.log('🤖 Moderation worker bootstrap:', workerResult);
  }

  if (process.env.YENKASA_ENABLE_INLINE_YME_WORKERS !== 'false') {
    const workerResult = await startYmeWorkers().catch((error) => {
      console.error('❌ YME workers failed to start:', error.message);
      return { started: false, reason: error.message };
    });
    console.log('🧠 YME worker bootstrap:', workerResult);
  }

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log('🔌 Socket.IO is attached and listening.');
  });
}

startServer().catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  publishServerIncident({
    level: 'error',
    incidentType: 'startup_failure',
    args: ['server.js startup failed.', err],
  });
  process.exit(1);
});

module.exports = server;
