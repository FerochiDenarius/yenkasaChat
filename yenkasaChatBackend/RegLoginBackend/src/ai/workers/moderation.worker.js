require('dotenv').config();

const {
  closeModerationQueueResources,
  registerModerationWorkers,
} = require('../services/moderationQueue.service');
const {
  processImageModerationJob,
  processVideoModerationJob,
} = require('../services/moderationWorkflow.service');
const { createLogger } = require('../../yme/observability/logger');

const logger = createLogger('moderation.worker', {
  sourceModule: 'ai.moderation.worker',
});

async function startModerationWorkers() {
  const result = await registerModerationWorkers({
    imageProcessor: processImageModerationJob,
    videoProcessor: processVideoModerationJob,
  });

  logger.info('Moderation worker bootstrap completed.', {
    data: result,
  });
  return result;
}

if (require.main === module) {
  startModerationWorkers().catch((error) => {
    logger.error('Moderation worker bootstrap failed.', {
      error,
    });
    process.exit(1);
  });

  const shutdown = async () => {
    await closeModerationQueueResources();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  startModerationWorkers,
};
