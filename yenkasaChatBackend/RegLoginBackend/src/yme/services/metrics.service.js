const MAX_DURATION_SAMPLES = 300;

const state = {
  counters: new Map(),
  durations: new Map(),
  gauges: new Map(),
};

function incrementCounter(name, delta = 1) {
  const current = state.counters.get(name) || 0;
  state.counters.set(name, current + Number(delta || 0));
}

function setGauge(name, value) {
  state.gauges.set(name, value);
}

function recordDuration(name, durationMs) {
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration < 0) return;

  const samples = state.durations.get(name) || [];
  samples.push(duration);
  if (samples.length > MAX_DURATION_SAMPLES) {
    samples.splice(0, samples.length - MAX_DURATION_SAMPLES);
  }
  state.durations.set(name, samples);
}

function summarizeDurations(samples) {
  if (!samples.length) {
    return {
      count: 0,
      avgMs: 0,
      minMs: 0,
      maxMs: 0,
      p95Ms: 0,
    };
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

  return {
    count: sorted.length,
    avgMs: Number((total / sorted.length).toFixed(2)),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    p95Ms: sorted[p95Index],
  };
}

function getMetricsSnapshot() {
  return {
    counters: Object.fromEntries(state.counters.entries()),
    durations: Object.fromEntries(
      [...state.durations.entries()].map(([name, samples]) => [name, summarizeDurations(samples)]),
    ),
    gauges: Object.fromEntries(state.gauges.entries()),
  };
}

module.exports = {
  incrementCounter,
  setGauge,
  recordDuration,
  getMetricsSnapshot,
};
