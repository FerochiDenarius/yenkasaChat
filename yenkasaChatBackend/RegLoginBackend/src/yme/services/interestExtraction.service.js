const { normalizeText } = require('../utils/textNormalizer');
const { clamp, ensureArray, uniqueStrings } = require('../utils/yme.utils');

function logNormalizationError(error) {
  console.error('[YME_NORMALIZATION_ERROR]', {
    message: error.message,
    stack: error.stack,
  });
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'your',
  'just',
  'about',
  'into',
  'after',
  'when',
  'what',
  'where',
  'they',
  'them',
  'then',
  'than',
  'been',
  'will',
  'would',
  'could',
  'should',
  'there',
  'their',
  'make',
  'made',
  'need',
  'want',
  'yenkasa',
]);

const EVENT_WEIGHTS = Object.freeze({
  like: 0.8,
  comment: 1.4,
  share: 1.6,
  follow: 1.8,
  watch: 1.3,
  scroll: 0.5,
  profile_visit: 1.0,
  search: 1.7,
  chat_message: 1.5,
  chat_response: 1.0,
  caption: 1.2,
  creator_interaction: 1.4,
  ad_engagement: 1.1,
  notification_open: 0.4,
  live_stream_join: 1.45,
  live_interaction: 1.5,
  stream_started: 1.6,
  stream_joined: 1.45,
  stream_comment: 1.55,
  stream_like: 1.2,
  stream_gift: 1.9,
  stream_share: 1.65,
  stream_follow_host: 1.8,
  stream_view_duration: 1.7,
  reward_claim: 1.1,
  community_join: 1.05,
  community_post_created: 1.3,
  notification_sent: 0.15,
  notification_opened: 0.45,
  notification_dismissed: 0.08,
});

function tokenize(text) {
  const safeText = normalizeText(text || '');
  return safeText
    .split(/[^a-z0-9#@]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function detectCommerceSignals(text) {
  const lowered = normalizeText(text || '');
  const keywords = [
    'buy',
    'sell',
    'price',
    'shop',
    'order',
    'discount',
    'deal',
    'market',
    'cart',
    'payment',
    'delivery',
  ];

  return keywords
    .filter((keyword) => lowered.includes(keyword))
    .map((keyword) => ({
      label: keyword,
      score: 0.7,
      sourceCount: 1,
      lastSeenAt: new Date(),
    }));
}

function detectEmotionalSignals(text) {
  const lowered = normalizeText(text || '');
  const patterns = [
    ['excited', /(excited|happy|celebrate|amazing)/],
    ['frustrated', /(frustrated|annoyed|problem|issue)/],
    ['curious', /(curious|learn|explore|why|how)/],
    ['urgent', /(urgent|asap|immediately|now)/],
  ];

  return patterns
    .filter(([, expression]) => expression.test(lowered))
    .map(([label]) => ({
      label,
      score: 0.65,
      sourceCount: 1,
      lastSeenAt: new Date(),
    }));
}

function extractInterestSignals(event = {}) {
  try {
    const weight = EVENT_WEIGHTS[event.eventType] || 1;
    const metadata = event.payload || {};
    const textSources = [
      event.normalizedText,
      metadata.caption,
      metadata.message,
      metadata.query,
      metadata.searchQuery,
      metadata.title,
    ];
    const tokenPool = uniqueStrings(
      textSources.flatMap((text) => tokenize(text)),
      16,
    );
    const explicitLabels = uniqueStrings([
      ...ensureArray(metadata.category),
      ...ensureArray(metadata.categories),
      ...ensureArray(metadata.tags),
      ...ensureArray(metadata.hashtags),
      ...ensureArray(event.interestCandidates),
    ]);

    const interestLabels = uniqueStrings([...explicitLabels, ...tokenPool], 12);
    const interests = interestLabels.map((label, index) => ({
      label,
      score: clamp(weight - index * 0.05, 0.25, 1),
      sourceCount: 1,
      lastSeenAt: new Date(),
    }));

    const contentCategories = uniqueStrings(
      explicitLabels.filter((label) => !label.startsWith('#')),
      8,
    );

    return {
      interests,
      contentCategories,
      commerceSignals: detectCommerceSignals(textSources.join(' ')),
      emotionalPatterns: detectEmotionalSignals(textSources.join(' ')),
      creatorSignals: event.creatorId
        ? [
            {
              creatorId: event.creatorId,
              score: weight,
              lastEngagedAt: new Date(event.occurredAt || Date.now()),
            },
          ]
        : [],
    };
  } catch (error) {
    logNormalizationError(error);
    throw error;
  }
}

module.exports = {
  extractInterestSignals,
};
