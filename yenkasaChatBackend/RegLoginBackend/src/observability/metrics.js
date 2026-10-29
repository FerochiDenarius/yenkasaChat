const counters = new Map();
const durations = new Map();

function keyFor(labels) {
  return JSON.stringify(labels);
}

function increment(name, labels = {}, amount = 1) {
  const key = keyFor(labels);
  const current = counters.get(name) || new Map();
  current.set(key, (current.get(key) || 0) + amount);
  counters.set(name, current);
}

function observe(name, labels = {}, value) {
  const key = keyFor(labels);
  const current = durations.get(name) || new Map();
  const item = current.get(key) || { count: 0, sum: 0 };
  item.count += 1;
  item.sum += value;
  current.set(key, item);
  durations.set(name, current);
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function labelsToPrometheus(labels) {
  const entries = Object.entries(labels);
  if (!entries.length) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`;
}

function render() {
  const lines = [
    '# HELP yenkasa_http_requests_total Total HTTP requests handled by the API.',
    '# TYPE yenkasa_http_requests_total counter',
  ];

  for (const [name, values] of counters) {
    for (const [serializedLabels, value] of values) {
      lines.push(`${name}${labelsToPrometheus(JSON.parse(serializedLabels))} ${value}`);
    }
  }

  for (const [name, values] of durations) {
    for (const [serializedLabels, value] of values) {
      const labels = JSON.parse(serializedLabels);
      lines.push(`${name}_count${labelsToPrometheus(labels)} ${value.count}`);
      lines.push(`${name}_sum${labelsToPrometheus(labels)} ${(value.sum / 1000).toFixed(6)}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function requestMetrics(req, res, next) {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = req.route?.path || req.path || 'unknown';
    const labels = { method: req.method, route, status: res.statusCode };
    increment('yenkasa_http_requests_total', labels);
    observe('yenkasa_http_request_duration_seconds', labels, durationMs);
  });
  next();
}

module.exports = { increment, observe, render, requestMetrics };
