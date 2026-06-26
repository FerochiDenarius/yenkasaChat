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

function flagEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function firestoreProjectManagementBoot() {
  return flagEnabled(process.env.SOFTOTECH_FIRESTORE_ONLY) ||
    flagEnabled(process.env.PROJECT_MANAGEMENT_FIRESTORE_ONLY) ||
    String(process.env.SOFTOTECH_BOOT_MODE || '').trim().toLowerCase() === 'firestore';
}

async function startServer() {
  console.log('🛢️ Server incident OIL bridge:', serverIncidentOilStatus);
  const firestoreOnly = firestoreProjectManagementBoot();
  if (firestoreOnly) {
    console.log('server.js: Firestore project-management boot enabled; skipping MongoDB connection, Mongo permission seed, and Mongo schedulers.');
  } else {
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
  }

  const relayStatus = startIntelligenceEventRelay();
  console.log('🛰️ Intelligence relay bootstrap:', relayStatus);

  if (!firestoreOnly && process.env.YENKASA_ENABLE_INLINE_MODERATION_WORKERS !== 'false') {
    const workerResult = await startModerationWorkers().catch((error) => {
      console.error('❌ Moderation workers failed to start:', error.message);
      return { started: false, reason: error.message };
    });
    console.log('🤖 Moderation worker bootstrap:', workerResult);
  }

  if (!firestoreOnly && process.env.YENKASA_ENABLE_INLINE_YME_WORKERS !== 'false') {
    const workerResult = await startYmeWorkers().catch((error) => {
      console.error('❌ YME workers failed to start:', error.message);
      return { started: false, reason: error.message };
    });
    console.log('🧠 YME worker bootstrap:', workerResult);
  }

  const PORT = process.env.PORT || 8080;
  const HOST = process.env.HOST || '0.0.0.0';
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on ${HOST}:${PORT}`);
    console.log('🔌 Socket.IO is attached and listening.');
  });
}

startServer().catch((err) => {
  console.error('❌ Server startup error:', err.message);
  publishServerIncident({
    level: 'error',
    incidentType: 'startup_failure',
    args: ['server.js startup failed.', err],
  });
  process.exit(1);
});

module.exports = server;
