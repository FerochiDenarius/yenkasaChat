require('dotenv').config();

const {
  closeModerationQueueResources,
  registerModerationWorkers,
} = require('../services/moderationQueue.service');
const {
  processImageModerationJob,
  processVideoModerationJob,
} = require('../services/moderationWorkflow.service');

async function startModerationWorkers() {
  const result = await registerModerationWorkers({
    imageProcessor: processImageModerationJob,
    videoProcessor: processVideoModerationJob,
  });

  console.log('[ModerationWorker] startup result', result);
  return result;
}

if (require.main === module) {
  startModerationWorkers().catch((error) => {
    console.error('[ModerationWorker] failed to start:', error);
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
