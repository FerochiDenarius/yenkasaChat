const {
  closeYmeQueueResources,
  registerYmeWorkers,
} = require('../services/queue.service');
const { closeBridgeQueueResources } = require('../bridge/bridgeQueue');
const { startBridgeWorkers } = require('../bridge/bridgeWorker');
const {
  processChatSummaryJob,
  processEmbeddingRefreshJob,
  processEventPipeline,
  runMemoryConsolidation,
} = require('../services/consolidation.service');
const { createLogger } = require('../observability/logger');

const logger = createLogger('yme.worker', {
  sourceModule: 'yme.worker',
});

async function startYmeWorkers() {
  const ymeResult = await registerYmeWorkers({
    eventProcessor: async (job) =>
      processEventPipeline({
        eventId: job.data?.eventId,
        trigger: 'bullmq_worker',
      }),
    embeddingProcessor: async (job) => processEmbeddingRefreshJob(job.data || {}),
    consolidationProcessor: async (job) => runMemoryConsolidation(job.data || {}),
    chatSummaryProcessor: async (job) => processChatSummaryJob(job.data || {}),
  });

  const bridgeResult = await startBridgeWorkers().catch((error) => ({
    started: false,
    reason: error.message,
  }));

  return {
    yme: ymeResult,
    bridge: bridgeResult,
  };
}

if (require.main === module) {
  startYmeWorkers()
    .then((result) => {
      logger.info('YME worker bootstrap completed.', {
        data: result,
      });
    })
    .catch((error) => {
      logger.error('YME worker bootstrap failed.', {
        error,
      });
      process.exit(1);
    });

  const shutdown = async () => {
    await closeYmeQueueResources();
    await closeBridgeQueueResources();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  startYmeWorkers,
};
