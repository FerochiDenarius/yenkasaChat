require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const initSocket = require('./config/socket');
const { startModerationWorkers } = require('./ai/workers/moderation.worker');
const { startYmeWorkers } = require('./yme/workers/yme.worker');
const { createLogger } = require('./yme/observability/logger');

const Permission = require('../models/permissions.model');

const server = http.createServer(app);
initSocket(server);
const logger = createLogger('app.server', {
  sourceModule: 'server.bootstrap',
});

async function startServer() {
  logger.info('Connecting to MongoDB.');
  await connectDB();
  logger.info('MongoDB connected successfully.');

  await Permission.seedDefaults()
    .then(() => {
      logger.info('Permissions seeded.');
    })
    .catch((error) => {
      logger.error('Permission seeding failed.', {
        error,
      });
    });

  require('../services/verificationScheduler');
  require('../services/ykcMonthlyReset');
  logger.info('Verification scheduler initialized.');

  if (process.env.YENKASA_ENABLE_INLINE_MODERATION_WORKERS !== 'false') {
    const workerResult = await startModerationWorkers().catch((error) => {
      logger.error('Moderation workers failed to start.', {
        error,
      });
      return { started: false, reason: error.message };
    });
    logger.info('Moderation worker bootstrap completed.', {
      data: workerResult,
    });
  }

  if (process.env.YENKASA_ENABLE_INLINE_YME_WORKERS !== 'false') {
    const workerResult = await startYmeWorkers().catch((error) => {
      logger.error('YME workers failed to start.', {
        error,
      });
      return { started: false, reason: error.message };
    });
    logger.info('YME worker bootstrap completed.', {
      data: workerResult,
    });
  }

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, '0.0.0.0', () => {
    logger.info('HTTP server listening.', {
      data: {
        env: process.env.NODE_ENV,
        port: Number(PORT),
      },
    });
  });
}

startServer().catch((err) => {
  logger.error('Server bootstrap failed.', {
    error: err,
  });
  process.exit(1);
});

module.exports = server;
