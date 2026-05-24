const { ingestEvent, ingestEventBatch } = require('./eventIngestion.service');

function publishYmeEvent(event, options = {}) {
  const task = ingestEvent(event, options).catch((error) => {
    console.warn('[YME] Failed to publish event:', error.message, {
      eventType: event?.eventType || event?.type,
      userId: event?.userId || options?.defaults?.userId || null,
    });
    return null;
  });

  return options.awaitIngest === true ? task : undefined;
}

function publishYmeEventBatch(events, options = {}) {
  const task = ingestEventBatch(events, options).catch((error) => {
    console.warn('[YME] Failed to publish event batch:', error.message, {
      count: Array.isArray(events) ? events.length : 0,
    });
    return null;
  });

  return options.awaitIngest === true ? task : undefined;
}

module.exports = {
  publishYmeEvent,
  publishYmeEventBatch,
};
