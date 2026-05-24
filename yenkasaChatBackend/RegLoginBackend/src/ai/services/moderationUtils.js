function clampScore(value, precision = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const clamped = Math.max(0, Math.min(1, numeric));
  return Number(clamped.toFixed(precision));
}

function roundScore(value, precision = 2) {
  return Number(clampScore(value, precision).toFixed(precision));
}

function averageScore(values = []) {
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!normalized.length) return 0;
  return clampScore(
    normalized.reduce((sum, value) => sum + value, 0) / normalized.length,
  );
}

function maxScore(values = []) {
  return clampScore(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .reduce((currentMax, value) => Math.max(currentMax, value), 0),
  );
}

function normalizeList(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function uniqueList(values) {
  return [...new Set(normalizeList(values))];
}

function toPlainObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : fallback;
}

function truncateText(value, maxLength = 220) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function buildTextExcerpt(text, matches = [], maxLength = 220) {
  const normalized = String(text || '').trim();
  if (!normalized) return '';

  const firstMatch = normalizeList(matches)[0];
  if (!firstMatch) return truncateText(normalized, maxLength);

  const lowered = normalized.toLowerCase();
  const loweredNeedle = firstMatch.toLowerCase();
  const matchIndex = lowered.indexOf(loweredNeedle);
  if (matchIndex === -1) return truncateText(normalized, maxLength);

  const start = Math.max(0, matchIndex - Math.floor(maxLength / 3));
  const end = Math.min(normalized.length, start + maxLength);
  const excerpt = normalized.slice(start, end).trim();
  return start > 0 ? `…${excerpt}` : excerpt;
}

function mergeEvidence(...collections) {
  return collections
    .flat()
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      score: entry?.score == null ? undefined : clampScore(entry.score),
    }));
}

module.exports = {
  averageScore,
  buildTextExcerpt,
  clampScore,
  maxScore,
  mergeEvidence,
  normalizeList,
  roundScore,
  toPlainObject,
  truncateText,
  uniqueList,
};
