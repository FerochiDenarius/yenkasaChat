const {
  closeYmeQueueResources,
  registerYmeWorkers,
} = require('../services/queue.service');
const { validateYmeRuntime } = require('../bootstrap/validateYmeRuntime');
const {
  processChatSummaryJob,
  processEmbeddingRefreshJob,
  processEventPipeline,
  runMemoryConsolidation,
} = require('../services/consolidation.service');

async function startYmeWorkers() {
  validateYmeRuntime();
  console.log('[YME] normalizeText loaded successfully');
  return registerYmeWorkers({
    eventProcessor: async (job) =>
      processEventPipeline({
        eventId: job.data?.eventId,
        trigger: 'bullmq_worker',
      }),
    embeddingProcessor: async (job) => processEmbeddingRefreshJob(job.data || {}),
    consolidationProcessor: async (job) => runMemoryConsolidation(job.data || {}),
    chatSummaryProcessor: async (job) => processChatSummaryJob(job.data || {}),
  });
}

if (require.main === module) {
  startYmeWorkers()
    .then((result) => {
      console.log('[YME] Worker bootstrap result:', result);
    })
    .catch((error) => {
      console.error('[YME] Worker bootstrap failed:', error);
      process.exit(1);
    });

  const shutdown = async () => {
    await closeYmeQueueResources();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  startYmeWorkers,
};
