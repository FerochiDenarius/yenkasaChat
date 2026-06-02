const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { clamp } = require('../utils/yme.utils');

const BASE_SCORES = Object.freeze({
  like: 0.12,
  comment: 0.48,
  share: 0.55,
  follow: 0.62,
  unfollow: 0.34,
  watch: 0.18,
  post_view: 0.08,
  video_watch: 0.22,
  watch_duration: 0.26,
  save_post: 0.58,
  profile_visit: 0.18,
  search: 0.38,
  chat_message: 0.62,
  ai_chat_message: 0.72,
  chat_response: 0.56,
  caption: 0.64,
  creator_interaction: 0.44,
  notification_open: 0.14,
  live_stream_join: 0.32,
  live_interaction: 0.38,
  stream_started: 0.7,
  stream_ended: 0.5,
  stream_joined: 0.38,
  stream_left: 0.3,
  stream_comment: 0.52,
  stream_like: 0.2,
  stream_gift: 0.78,
  stream_share: 0.58,
  stream_report: 0.82,
  stream_follow_host: 0.64,
  stream_pin_comment: 0.62,
  stream_moderation_action: 0.74,
  stream_ban_user: 0.86,
  stream_warning: 0.76,
  stream_view_duration: 0.42,
  stream_peak_viewers: 0.46,
  reward_claim: 0.46,
  ad_interaction: 0.16,
  ad_engagement: 0.16,
  community_join: 0.48,
  community_post_created: 0.58,
  notification_sent: 0.12,
  notification_opened: 0.22,
  notification_dismissed: 0.1,
});

const LOW_SIGNAL_TEXT = [
  /^hi+$/i,
  /^hello+$/i,
  /^hey+$/i,
  /^ok+$/i,
  /^thanks?$/i,
  /^lol+$/i,
  /^yes$/i,
  /^no$/i,
];

const COMMERCE_HINTS = /\b(buy|sell|price|budget|invoice|payment|shipping|customer|order|vendor|deal)\b/i;

function isLowSignalText(text = '') {
  const normalized = normalizeText(text || '');
  if (!normalized) return true;
  return LOW_SIGNAL_TEXT.some((pattern) => pattern.test(normalized));
}

function scoreEventImportance(event = {}) {
  const config = getYmeConfig();
  const text = normalizeText(event?.normalizedText || '');
  const metadata = event.eventMetadata || {};
  const baseScore = BASE_SCORES[event.eventType] ?? 0.2;
  let score = baseScore;
  const reasons = [`base:${event.eventType || 'unknown'}=${baseScore.toFixed(2)}`];

  if (text.length >= 48) {
    score += 0.12;
    reasons.push('rich_text');
  } else if (text.length >= 20) {
    score += 0.06;
    reasons.push('medium_text');
  } else if (text.length <= config.importance.lowSignalMaxChars && isLowSignalText(text)) {
    score -= 0.16;
    reasons.push('low_signal_text');
  }

  if ((event.interestCandidates || []).length >= 2) {
    score += 0.08;
    reasons.push('interest_candidates');
  }

  if (Number(metadata.watchTimeMs || 0) >= 10000) {
    score += 0.1;
    reasons.push('watch_time_10s');
  }
  if (Number(metadata.watchTimeMs || 0) >= 30000) {
    score += 0.08;
    reasons.push('watch_time_30s');
  }

  if (Number(metadata.feedDwellMs || 0) >= 8000) {
    score += 0.06;
    reasons.push('feed_dwell');
  }

  if (Number(metadata.rewatchCount || 0) > 0) {
    score += Math.min(0.12, Number(metadata.rewatchCount || 0) * 0.04);
    reasons.push('rewatch');
  }

  if (Number(metadata.skipSpeed || 0) >= 1.8) {
    score -= 0.08;
    reasons.push('fast_skip');
  }

  if (Number(metadata.engagementValue || 0) >= 1) {
    score += Math.min(0.1, Number(metadata.engagementValue || 0) * 0.03);
    reasons.push('engagement_value');
  }

  if (COMMERCE_HINTS.test(text)) {
    score += 0.08;
    reasons.push('commerce_signal');
  }

  const importanceScore = clamp(score, 0.01, 0.99);
  let band = 'low';
  if (importanceScore >= config.importance.highThreshold) band = 'high';
  else if (importanceScore >= config.importance.mediumThreshold) band = 'medium';

  return {
    importanceScore,
    importanceBand: band,
    importanceReason: reasons.join(','),
  };
}

module.exports = {
  scoreEventImportance,
};
