const { createLogger } = require('../observability/logger');
const { closeBridgeQueueResources, registerBridgeWorkers } = require('./bridgeQueue');
const { deliverBridgeBatch } = require('../services/intelligenceBridge.service');

const logger = createLogger('yme.bridge_worker', {
  sourceModule: 'bridge.worker',
});

async function startBridgeWorkers() {
  const result = await registerBridgeWorkers({
    eventProcessor: async (job) => deliverBridgeBatch('events', job),
    logProcessor: async (job) => deliverBridgeBatch('logs', job),
  });

  logger.info('Bridge worker bootstrap completed.', {
    data: result,
  });
  return result;
}

if (require.main === module) {
  startBridgeWorkers().catch((error) => {
    logger.error('Bridge worker bootstrap failed.', {
      error,
    });
    process.exit(1);
  });

  const shutdown = async () => {
    await closeBridgeQueueResources();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  startBridgeWorkers,
};
