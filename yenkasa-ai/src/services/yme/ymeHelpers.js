export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function formatCount(value, fallback = "—") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
}

export function formatDecimal(value, digits = 1, fallback = "—") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function formatPercent(value, digits = 0, fallback = "—") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return `${(numeric * 100).toFixed(digits)}%`;
}

export function formatDuration(value, fallback = "—") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric >= 1000) return `${formatDecimal(numeric / 1000, 1)}s`;
  return `${Math.round(numeric)}ms`;
}

export function formatDate(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function summarizeByDay(events = [], valueResolver = () => 1) {
  const buckets = new Map();

  for (const event of safeArray(events)) {
    const date = new Date(event?.occurredAt || event?.createdAt || Date.now());
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + Number(valueResolver(event) || 0));
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([day, value]) => ({ day, value }));
}

export function summarizeByType(items = [], typeKey = "eventType", valueKey = null) {
  const buckets = new Map();

  for (const item of safeArray(items)) {
    const key = String(item?.[typeKey] || "other").trim() || "other";
    const increment = valueKey ? Number(item?.[valueKey] || 0) : 1;
    buckets.set(key, (buckets.get(key) || 0) + increment);
  }

  return [...buckets.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

export function summarizeQueueSeries(queueHealth = {}) {
  const queues = queueHealth?.queues || {};
  return Object.entries(queues).map(([name, value]) => ({
    name,
    pending: Number(value?.waitingCount || value?.wait || value?.queued || 0),
    active: Number(value?.activeCount || value?.active || value?.running || 0),
    completed: Number(value?.completedCount || value?.completed || 0),
    failed: Number(value?.failedCount || value?.failed || 0),
  }));
}

export function createHourlyHeatmap(activeHours = []) {
  const byHour = new Map();
  safeArray(activeHours).forEach((entry) => {
    const hour = Number(entry?.hour ?? entry?.label ?? entry?.key);
    if (!Number.isFinite(hour)) return;
    byHour.set(((hour % 24) + 24) % 24, Number(entry?.score ?? entry?.value ?? 0));
  });

  return Array.from({ length: 24 }, (_item, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    value: byHour.get(hour) || 0,
  }));
}
