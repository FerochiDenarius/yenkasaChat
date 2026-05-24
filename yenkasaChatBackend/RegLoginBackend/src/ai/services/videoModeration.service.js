const { MODERATION_ACTIONS } = require('./moderationThresholds');

async function moderateVideoPlaceholder({
  videoUrl = '',
  audioUrl = '',
} = {}) {
  const asset = String(videoUrl || audioUrl || '').trim();

  return {
    source: videoUrl ? 'video' : 'audio',
    asset,
    confidence: 0,
    flagged: false,
    recommendedAction: MODERATION_ACTIONS.PENDING_SCAN,
    reasons: [
      videoUrl
        ? 'Video moderation is queued for a future model pipeline.'
        : 'Audio moderation is queued for a future transcription pipeline.',
    ],
    flaggedCategories: [],
    evidence: asset
      ? [
          {
            type: videoUrl ? 'video' : 'audio',
            source: 'placeholder',
            asset,
          },
        ]
      : [],
    durationMs: 0,
  };
}

module.exports = {
  moderateVideoPlaceholder,
};
