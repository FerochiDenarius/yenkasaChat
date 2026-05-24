const fs = require('node:fs');
const path = require('node:path');

const { getPipeline } = require('../utils/transformersRuntime');
const { getThresholds, MODERATION_ACTIONS } = require('./moderationThresholds');
const {
  averageScore,
  clampScore,
  maxScore,
  normalizeList,
  roundScore,
  uniqueList,
} = require('./moderationUtils');
const {
  recordDuration,
  recordModelUsage,
} = require('./moderationMetrics.service');

const DEFAULT_NSFW_MODEL =
  process.env.YENKASA_IMAGE_NSFW_MODEL || 'Falconsai/nsfw_image_detection';
const DEFAULT_ZERO_SHOT_MODEL =
  process.env.YENKASA_IMAGE_ZERO_SHOT_MODEL || 'Xenova/clip-vit-base-patch32';

const IMAGE_LABELS = Object.freeze({
  safe: 'safe everyday image',
  nudity: 'nudity or sexual content',
  violence: 'graphic violence or gore',
  weapon: 'firearm or dangerous weapon',
  hate: 'hate symbol or extremist imagery',
  scam: 'scam advertisement or payment fraud',
});

function normalizeImageInput({ imageUrl = '', filePath = '' } = {}) {
  const normalizedUrl = String(imageUrl || '').trim();
  if (normalizedUrl) {
    return {
      kind: 'url',
      value: normalizedUrl,
      source: normalizedUrl,
    };
  }

  const normalizedFilePath = String(filePath || '').trim();
  if (normalizedFilePath && fs.existsSync(normalizedFilePath)) {
    return {
      kind: 'file',
      value: normalizedFilePath,
      source: path.basename(normalizedFilePath),
    };
  }

  throw new Error('Image moderation requires an imageUrl or an existing filePath.');
}

function buildScoreShape() {
  return {
    safe: 0,
    nudity: 0,
    violence: 0,
    weapon: 0,
    hate: 0,
    scam: 0,
  };
}

function normalizeClassifierOutput(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.[0])) return raw[0];
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
}

function extractNsfwScores(raw) {
  const scores = buildScoreShape();
  const entries = normalizeClassifierOutput(raw);

  for (const entry of entries) {
    const label = String(entry?.label || '').toLowerCase();
    const score = clampScore(entry?.score);

    if (label.includes('nsfw')) {
      scores.nudity = Math.max(scores.nudity, score);
    }

    if (label.includes('sfw') || label.includes('neutral') || label.includes('safe')) {
      scores.safe = Math.max(scores.safe, score);
    }
  }

  return scores;
}

function extractZeroShotScores(raw) {
  const scores = buildScoreShape();

  const labels = Array.isArray(raw?.labels) ? raw.labels : [];
  const values = Array.isArray(raw?.scores) ? raw.scores : [];
  labels.forEach((label, index) => {
    const match = Object.entries(IMAGE_LABELS).find(([, candidateLabel]) => candidateLabel === label);
    if (!match) return;
    const [category] = match;
    scores[category] = Math.max(scores[category], clampScore(values[index]));
  });

  return scores;
}

async function runNsfwModel(imageInput) {
  try {
    const classifier = await getPipeline('image-classification', DEFAULT_NSFW_MODEL);
    recordModelUsage(DEFAULT_NSFW_MODEL);
    const raw = await classifier(imageInput.value);
    return {
      model: DEFAULT_NSFW_MODEL,
      raw,
      scores: extractNsfwScores(raw),
      error: null,
    };
  } catch (error) {
    return {
      model: DEFAULT_NSFW_MODEL,
      raw: null,
      scores: buildScoreShape(),
      error,
    };
  }
}

async function runZeroShotModel(imageInput) {
  try {
    const classifier = await getPipeline(
      'zero-shot-image-classification',
      DEFAULT_ZERO_SHOT_MODEL,
    );
    recordModelUsage(DEFAULT_ZERO_SHOT_MODEL);

    const candidateLabels = Object.values(IMAGE_LABELS);
    let raw = null;
    try {
      raw = await classifier(imageInput.value, candidateLabels, { multi_label: true });
    } catch (_firstError) {
      raw = await classifier(imageInput.value, {
        candidate_labels: candidateLabels,
        multi_label: true,
      });
    }

    return {
      model: DEFAULT_ZERO_SHOT_MODEL,
      raw,
      scores: extractZeroShotScores(raw),
      error: null,
    };
  } catch (error) {
    return {
      model: DEFAULT_ZERO_SHOT_MODEL,
      raw: null,
      scores: buildScoreShape(),
      error,
    };
  }
}

function determineRecommendedAction(scores, hasModelError) {
  const thresholds = getThresholds();
  if (hasModelError) return MODERATION_ACTIONS.REVIEW;

  if (
    scores.nudity >= thresholds.image.reject.nudity ||
    scores.violence >= thresholds.image.reject.violence ||
    scores.hate >= thresholds.image.reject.hate ||
    scores.scam >= thresholds.image.reject.scam
  ) {
    return MODERATION_ACTIONS.REJECT;
  }

  if (
    scores.nudity >= thresholds.image.review.nudity ||
    scores.violence >= thresholds.image.review.violence ||
    scores.weapon >= thresholds.image.review.weapon ||
    scores.hate >= thresholds.image.review.hate ||
    scores.scam >= thresholds.image.review.scam
  ) {
    return MODERATION_ACTIONS.REVIEW;
  }

  const maxRisk = maxScore([
    scores.nudity,
    scores.violence,
    scores.weapon,
    scores.hate,
    scores.scam,
  ]);

  if (scores.safe >= thresholds.image.safeApproveMin && maxRisk < 0.45) {
    return MODERATION_ACTIONS.APPROVE;
  }

  return maxRisk >= 0.5 ? MODERATION_ACTIONS.REVIEW : MODERATION_ACTIONS.APPROVE;
}

function buildReasons(scores) {
  const reasons = [];
  if (scores.nudity >= 0.55) reasons.push('Possible nudity or sexual content');
  if (scores.violence >= 0.55) reasons.push('Possible violence or gore');
  if (scores.weapon >= 0.55) reasons.push('Possible weapon imagery');
  if (scores.hate >= 0.55) reasons.push('Possible hate or extremist imagery');
  if (scores.scam >= 0.55) reasons.push('Possible scam or deceptive promo image');
  return reasons;
}

function buildEvidence({ imageInput, finalScores, nsfwResult, zeroShotResult }) {
  const riskCategories = Object.entries(finalScores)
    .filter(([category, score]) => category !== 'safe' && score >= 0.45)
    .map(([category]) => category);

  return riskCategories.map((category) => ({
    type: 'image',
    source: imageInput.kind,
    category,
    score: finalScores[category],
    asset: imageInput.source,
    modelSignals: {
      nsfw: nsfwResult.scores[category] || null,
      zeroShot: zeroShotResult.scores[category] || null,
    },
  }));
}

async function moderateImageContent({ imageUrl = '', filePath = '', includeDebug = false } = {}) {
  const startedAt = Date.now();
  const imageInput = normalizeImageInput({ imageUrl, filePath });

  const [nsfwResult, zeroShotResult] = await Promise.all([
    runNsfwModel(imageInput),
    runZeroShotModel(imageInput),
  ]);

  const finalScores = buildScoreShape();
  finalScores.safe = roundScore(
    Math.max(
      nsfwResult.scores.safe,
      zeroShotResult.scores.safe,
      1 - maxScore([
        nsfwResult.scores.nudity,
        zeroShotResult.scores.nudity,
        zeroShotResult.scores.violence,
        zeroShotResult.scores.weapon,
        zeroShotResult.scores.hate,
        zeroShotResult.scores.scam,
      ]),
    ),
  );
  finalScores.nudity = roundScore(Math.max(nsfwResult.scores.nudity, zeroShotResult.scores.nudity));
  finalScores.violence = roundScore(zeroShotResult.scores.violence);
  finalScores.weapon = roundScore(zeroShotResult.scores.weapon);
  finalScores.hate = roundScore(zeroShotResult.scores.hate);
  finalScores.scam = roundScore(zeroShotResult.scores.scam);

  const hasModelError = Boolean(nsfwResult.error || zeroShotResult.error);
  const recommendedAction = determineRecommendedAction(finalScores, hasModelError);
  const confidence = roundScore(
    maxScore([
      finalScores.safe,
      finalScores.nudity,
      finalScores.violence,
      finalScores.weapon,
      finalScores.hate,
      finalScores.scam,
    ]),
  );
  const evidence = buildEvidence({ imageInput, finalScores, nsfwResult, zeroShotResult });
  const durationMs = Date.now() - startedAt;
  const reasons = buildReasons(finalScores);
  if (hasModelError) {
    reasons.push('Image moderation model unavailable, routed to review');
  }
  recordDuration('image', durationMs);

  return {
    source: 'image',
    asset: imageInput.source,
    models: uniqueList([nsfwResult.model, zeroShotResult.model]),
    safe: finalScores.safe,
    nudity: finalScores.nudity,
    violence: finalScores.violence,
    weapon: finalScores.weapon,
    hate: finalScores.hate,
    scam: finalScores.scam,
    confidence,
    flagged: recommendedAction !== MODERATION_ACTIONS.APPROVE,
    recommendedAction,
    reasons,
    flaggedCategories: evidence.map((entry) => entry.category),
    evidence,
    durationMs,
    debug: includeDebug
      ? {
          nsfw: {
            raw: nsfwResult.raw,
            error: nsfwResult.error ? nsfwResult.error.message : null,
          },
          zeroShot: {
            raw: zeroShotResult.raw,
            error: zeroShotResult.error ? zeroShotResult.error.message : null,
          },
        }
      : undefined,
  };
}

async function moderateImageBatch({ imageUrls = [], filePaths = [], includeDebug = false } = {}) {
  const normalizedTargets = [
    ...normalizeList(imageUrls).map((imageUrl) => ({ imageUrl })),
    ...normalizeList(filePaths).map((filePath) => ({ filePath })),
  ];

  const results = [];
  for (const target of normalizedTargets) {
    results.push(await moderateImageContent({ ...target, includeDebug }));
  }

  if (!results.length) {
    return {
      source: 'image',
      models: [],
      safe: 1,
      nudity: 0,
      violence: 0,
      weapon: 0,
      hate: 0,
      scam: 0,
      confidence: 1,
      flagged: false,
      recommendedAction: MODERATION_ACTIONS.APPROVE,
      reasons: [],
      flaggedCategories: [],
      evidence: [],
      durationMs: 0,
      items: [],
    };
  }

  const scores = {
    safe: roundScore(averageScore(results.map((result) => result.safe))),
    nudity: roundScore(maxScore(results.map((result) => result.nudity))),
    violence: roundScore(maxScore(results.map((result) => result.violence))),
    weapon: roundScore(maxScore(results.map((result) => result.weapon))),
    hate: roundScore(maxScore(results.map((result) => result.hate))),
    scam: roundScore(maxScore(results.map((result) => result.scam))),
  };

  const hasReject = results.some((result) => result.recommendedAction === MODERATION_ACTIONS.REJECT);
  const hasReview = results.some((result) => result.recommendedAction === MODERATION_ACTIONS.REVIEW);
  const recommendedAction = hasReject
    ? MODERATION_ACTIONS.REJECT
    : hasReview
      ? MODERATION_ACTIONS.REVIEW
      : MODERATION_ACTIONS.APPROVE;

  return {
    source: 'image',
    models: uniqueList(results.flatMap((result) => result.models || [])),
    safe: scores.safe,
    nudity: scores.nudity,
    violence: scores.violence,
    weapon: scores.weapon,
    hate: scores.hate,
    scam: scores.scam,
    confidence: roundScore(maxScore(results.map((result) => result.confidence))),
    flagged: recommendedAction !== MODERATION_ACTIONS.APPROVE,
    recommendedAction,
    reasons: uniqueList(results.flatMap((result) => result.reasons || [])),
    flaggedCategories: uniqueList(results.flatMap((result) => result.flaggedCategories || [])),
    evidence: results.flatMap((result) => result.evidence || []),
    durationMs: results.reduce((sum, result) => sum + (result.durationMs || 0), 0),
    items: results,
  };
}

module.exports = {
  IMAGE_LABELS,
  moderateImageBatch,
  moderateImageContent,
};
