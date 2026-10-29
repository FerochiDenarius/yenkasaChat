require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const initSocket = require('./config/socket');
const { startModerationWorkers } = require('./ai/workers/moderation.worker');
const { startIntelligenceEventRelay } = require('./intelligence/services/eventPublisher.service');
const {
  installServerIncidentOilBridge,
  publishServerIncident,
} = require('./intelligence/services/serverIncidentOil.service');
const { startYmeWorkers } = require('./yme/workers/yme.worker');
const logger = require('./observability/logger');

const Permission = require('../models/permissions.model');

const server = http.createServer(app);
initSocket(server);
const serverIncidentOilStatus = installServerIncidentOilBridge();

function flagEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase(),
  );
}

function firestoreProjectManagementBoot() {
  return (
    flagEnabled(process.env.SOFTOTECH_FIRESTORE_ONLY) ||
    flagEnabled(process.env.PROJECT_MANAGEMENT_FIRESTORE_ONLY) ||
    String(process.env.SOFTOTECH_BOOT_MODE || '')
      .trim()
      .toLowerCase() === 'firestore'
  );
}

async function startServer() {
  logger.info('Server incident bridge initialized', serverIncidentOilStatus);
  const firestoreOnly = firestoreProjectManagementBoot();
  if (firestoreOnly) {
    logger.info('Firestore-only boot enabled');
  } else {
    logger.info('Connecting to MongoDB');
    await connectDB();
    logger.info('MongoDB connected');

    await Permission.seedDefaults()
      .then(() => {
        logger.info('Permissions seeded');
      })
      .catch((error) => logger.error('Permission seeding failed', error));

    require('../services/verificationScheduler');
    require('../services/ykcMonthlyReset');
    logger.info('Verification scheduler initialized');
  }

  const relayStatus = startIntelligenceEventRelay();
  logger.info('Intelligence relay bootstrapped', relayStatus);

  if (!firestoreOnly && process.env.YENKASA_ENABLE_INLINE_MODERATION_WORKERS !== 'false') {
    const workerResult = await startModerationWorkers().catch((error) => {
      logger.error('Moderation workers failed to start', error);
      return { started: false, reason: error.message };
    });
    logger.info('Moderation worker bootstrapped', workerResult);
  }

  if (!firestoreOnly && process.env.YENKASA_ENABLE_INLINE_YME_WORKERS !== 'false') {
    const workerResult = await startYmeWorkers().catch((error) => {
      logger.error('YME workers failed to start', error);
      return { started: false, reason: error.message };
    });
    logger.info('YME worker bootstrapped', workerResult);
  }

  const PORT = process.env.PORT || 8080;
  const HOST = process.env.HOST || '0.0.0.0';
  server.listen(PORT, HOST, () => {
    logger.info('HTTP server listening', { environment: process.env.NODE_ENV, host: HOST, port: PORT });
    logger.info('Socket.IO attached');
  });
}

startServer().catch((err) => {
  logger.error('Server startup failed', err);
  publishServerIncident({
    level: 'error',
    incidentType: 'startup_failure',
    args: ['server.js startup failed.', err],
  });
  process.exit(1);
});

module.exports = server;
