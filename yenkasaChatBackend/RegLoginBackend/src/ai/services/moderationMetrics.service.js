const { roundScore } = require('./moderationUtils');

const metricsState = {
  counters: {
    totalRequests: 0,
    flaggedPosts: 0,
    approvedPosts: 0,
    rejectedPosts: 0,
    reviewPosts: 0,
    pendingScanPosts: 0,
    queueJobsEnqueued: 0,
    queueJobsCompleted: 0,
    queueJobsFailed: 0,
  },
  durations: {
    text: [],
    image: [],
    aggregate: [],
    workflow: [],
    queueWait: [],
    queueProcess: [],
  },
  modelUsage: {},
  lastUpdatedAt: null,
};

function touchMetrics() {
  metricsState.lastUpdatedAt = new Date();
}

function incrementCounter(name, amount = 1) {
  if (!Object.prototype.hasOwnProperty.call(metricsState.counters, name)) {
    metricsState.counters[name] = 0;
  }

  metricsState.counters[name] += Number(amount) || 0;
  touchMetrics();
}

function recordDuration(name, durationMs) {
  const numeric = Number(durationMs);
  if (!Number.isFinite(numeric) || numeric < 0) return;

  if (!metricsState.durations[name]) {
    metricsState.durations[name] = [];
  }

  metricsState.durations[name].push(numeric);
  if (metricsState.durations[name].length > 200) {
    metricsState.durations[name].shift();
  }
  touchMetrics();
}

function recordModelUsage(modelName) {
  const key = String(modelName || 'unknown').trim() || 'unknown';
  metricsState.modelUsage[key] = (metricsState.modelUsage[key] || 0) + 1;
  touchMetrics();
}

function summarizeDurations(entries = []) {
  if (!entries.length) {
    return {
      count: 0,
      avgMs: 0,
      maxMs: 0,
    };
  }

  const sum = entries.reduce((total, value) => total + value, 0);
  return {
    count: entries.length,
    avgMs: roundScore(sum / entries.length, 2),
    maxMs: Math.max(...entries),
  };
}

function getModerationMetrics() {
  return {
    counters: { ...metricsState.counters },
    durations: Object.fromEntries(
      Object.entries(metricsState.durations).map(([key, entries]) => [
        key,
        summarizeDurations(entries),
      ]),
    ),
    modelUsage: { ...metricsState.modelUsage },
    accuracy: {
      approvedVsManual: null,
      reviewEscalationRate: null,
      notes: 'Populate after moderator decision analytics and appeals are tracked.',
    },
    lastUpdatedAt: metricsState.lastUpdatedAt,
  };
}

module.exports = {
  getModerationMetrics,
  incrementCounter,
  recordDuration,
  recordModelUsage,
};
