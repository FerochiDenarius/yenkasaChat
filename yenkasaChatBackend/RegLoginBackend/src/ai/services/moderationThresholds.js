const MODERATION_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REVIEW: 'review',
  REJECT: 'reject',
  PENDING_SCAN: 'pending_scan',
});

const POST_STATUSES = Object.freeze({
  LEGACY_PENDING: 'pending',
  APPROVED: 'approved',
  PENDING_REVIEW: 'pending_review',
  PENDING_SCAN: 'pending_scan',
  REJECTED: 'rejected',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  text: {
    reject: {
      toxicity: 0.92,
      hate: 0.9,
      scam: 0.92,
      harassment: 0.9,
    },
    review: {
      toxicity: 0.62,
      hate: 0.58,
      spam: 0.55,
      scam: 0.55,
      harassment: 0.58,
    },
  },
  image: {
    reject: {
      nudity: 0.9,
      violence: 0.92,
      hate: 0.85,
      scam: 0.9,
    },
    review: {
      nudity: 0.68,
      violence: 0.7,
      weapon: 0.7,
      hate: 0.62,
      scam: 0.72,
    },
    safeApproveMin: 0.55,
  },
  aggregate: {
    reject: {
      nudity: 0.9,
      scam: 0.92,
      violence: 0.92,
      hate: 0.9,
    },
    review: {
      violence: 0.7,
      weapon: 0.7,
      toxicity: 0.62,
      scam: 0.55,
      hate: 0.58,
      harassment: 0.58,
      nudity: 0.68,
    },
  },
  queue: {
    imageAttempts: 3,
    videoAttempts: 1,
    imageBackoffMs: 5000,
    videoBackoffMs: 15000,
    imageConcurrency: 1,
    videoConcurrency: 1,
  },
});

function safeJsonParse(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function mergeDeep(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return base;
  }

  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function getThresholds() {
  const envOverrides = safeJsonParse(
    process.env.YENKASA_MODERATION_THRESHOLDS_JSON,
    {},
  );

  const thresholds = mergeDeep(DEFAULT_THRESHOLDS, envOverrides);

  const nudityReject = Number(
    process.env.YENKASA_IMAGE_REJECT_NUDITY_THRESHOLD ||
      thresholds.image.reject.nudity,
  );
  if (Number.isFinite(nudityReject)) thresholds.image.reject.nudity = nudityReject;

  const violenceReview = Number(
    process.env.YENKASA_IMAGE_REVIEW_VIOLENCE_THRESHOLD ||
      thresholds.image.review.violence,
  );
  if (Number.isFinite(violenceReview)) {
    thresholds.image.review.violence = violenceReview;
  }

  const scamReview = Number(
    process.env.YENKASA_TEXT_REVIEW_SCAM_THRESHOLD ||
      thresholds.text.review.scam,
  );
  if (Number.isFinite(scamReview)) thresholds.text.review.scam = scamReview;

  return thresholds;
}

function mapActionToPostStatus(action) {
  switch (action) {
    case MODERATION_ACTIONS.APPROVE:
      return POST_STATUSES.APPROVED;
    case MODERATION_ACTIONS.REJECT:
      return POST_STATUSES.REJECTED;
    case MODERATION_ACTIONS.PENDING_SCAN:
      return POST_STATUSES.PENDING_SCAN;
    case MODERATION_ACTIONS.REVIEW:
    default:
      return POST_STATUSES.PENDING_REVIEW;
  }
}

function isPendingPostStatus(status) {
  return [
    POST_STATUSES.LEGACY_PENDING,
    POST_STATUSES.PENDING_REVIEW,
    POST_STATUSES.PENDING_SCAN,
  ].includes(String(status || '').trim());
}

function isHumanReviewStatus(status) {
  return [
    POST_STATUSES.LEGACY_PENDING,
    POST_STATUSES.PENDING_REVIEW,
  ].includes(String(status || '').trim());
}

module.exports = {
  MODERATION_ACTIONS,
  POST_STATUSES,
  DEFAULT_THRESHOLDS,
  getThresholds,
  mapActionToPostStatus,
  isPendingPostStatus,
  isHumanReviewStatus,
};
