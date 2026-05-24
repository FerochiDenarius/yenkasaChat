const { getThresholds, mapActionToPostStatus, MODERATION_ACTIONS } = require('./moderationThresholds');
const {
  clampScore,
  maxScore,
  mergeEvidence,
  roundScore,
  uniqueList,
} = require('./moderationUtils');
const { recordDuration } = require('./moderationMetrics.service');

function normalizeTextScores(textResult = {}) {
  return {
    toxicity: clampScore(textResult?.scores?.toxicity),
    hate: clampScore(textResult?.scores?.hate),
    spam: clampScore(textResult?.scores?.spam),
    scam: clampScore(textResult?.scores?.scam),
    harassment: clampScore(textResult?.scores?.harassment),
  };
}

function normalizeImageScores(imageResult = {}) {
  return {
    safe: clampScore(imageResult?.safe),
    nudity: clampScore(imageResult?.nudity),
    violence: clampScore(imageResult?.violence),
    weapon: clampScore(imageResult?.weapon),
    hate: clampScore(imageResult?.hate),
    scam: clampScore(imageResult?.scam),
  };
}

function normalizeVideoScores(videoResult = {}) {
  return {
    nudity: clampScore(videoResult?.nudity),
    violence: clampScore(videoResult?.violence),
    weapon: clampScore(videoResult?.weapon),
    hate: clampScore(videoResult?.hate),
    scam: clampScore(videoResult?.scam),
  };
}

function buildActionReasons({ scores, textResult, imageResult, videoResult, pendingSources }) {
  const reasons = uniqueList([
    ...(textResult?.reasons || []),
    ...(imageResult?.reasons || []),
    ...(videoResult?.reasons || []),
  ]);

  if (pendingSources.length) {
    reasons.push(`Awaiting ${pendingSources.join(', ')} moderation scan`);
  }

  if (scores.nudity >= 0.9) reasons.push('High-confidence nudity signal');
  if (scores.violence >= 0.7 && scores.weapon >= 0.7) reasons.push('Violence combined with weapon imagery');
  if (scores.scam >= 0.92) reasons.push('High-confidence scam signal');
  if (scores.hate >= 0.9) reasons.push('High-confidence hate signal');

  return uniqueList(reasons);
}

function deriveFinalAction({ scores, textResult, imageResult, videoResult, pendingSources }) {
  const thresholds = getThresholds();
  const sourceActions = [
    textResult?.recommendedAction,
    imageResult?.recommendedAction,
    videoResult?.recommendedAction,
  ].filter(Boolean);

  if (
    scores.nudity >= thresholds.aggregate.reject.nudity ||
    scores.scam >= thresholds.aggregate.reject.scam ||
    scores.violence >= thresholds.aggregate.reject.violence ||
    scores.hate >= thresholds.aggregate.reject.hate ||
    sourceActions.includes(MODERATION_ACTIONS.REJECT)
  ) {
    return MODERATION_ACTIONS.REJECT;
  }

  if (pendingSources.length) {
    const alreadyNeedsReview =
      sourceActions.includes(MODERATION_ACTIONS.REVIEW) ||
      scores.violence >= thresholds.aggregate.review.violence ||
      scores.weapon >= thresholds.aggregate.review.weapon ||
      scores.toxicity >= thresholds.aggregate.review.toxicity ||
      scores.scam >= thresholds.aggregate.review.scam ||
      scores.hate >= thresholds.aggregate.review.hate ||
      scores.harassment >= thresholds.aggregate.review.harassment ||
      scores.nudity >= thresholds.aggregate.review.nudity;

    return alreadyNeedsReview ? MODERATION_ACTIONS.REVIEW : MODERATION_ACTIONS.PENDING_SCAN;
  }

  if (
    sourceActions.includes(MODERATION_ACTIONS.REVIEW) ||
    scores.violence >= thresholds.aggregate.review.violence ||
    (scores.violence >= thresholds.aggregate.review.violence &&
      scores.weapon >= thresholds.aggregate.review.weapon) ||
    scores.toxicity >= thresholds.aggregate.review.toxicity ||
    scores.scam >= thresholds.aggregate.review.scam ||
    scores.hate >= thresholds.aggregate.review.hate ||
    scores.harassment >= thresholds.aggregate.review.harassment ||
    scores.nudity >= thresholds.aggregate.review.nudity
  ) {
    return MODERATION_ACTIONS.REVIEW;
  }

  return MODERATION_ACTIONS.APPROVE;
}

async function aggregateModerationResults({
  textResult = null,
  imageResult = null,
  videoResult = null,
  pendingSources = [],
  includeDebug = false,
} = {}) {
  const startedAt = Date.now();
  const normalizedPendingSources = uniqueList(pendingSources);
  const textScores = normalizeTextScores(textResult);
  const imageScores = normalizeImageScores(imageResult);
  const videoScores = normalizeVideoScores(videoResult);

  const aggregateScores = {
    toxicity: roundScore(textScores.toxicity),
    harassment: roundScore(textScores.harassment),
    spam: roundScore(textScores.spam),
    scam: roundScore(maxScore([textScores.scam, imageScores.scam, videoScores.scam])),
    hate: roundScore(maxScore([textScores.hate, imageScores.hate, videoScores.hate])),
    nudity: roundScore(maxScore([imageScores.nudity, videoScores.nudity])),
    violence: roundScore(maxScore([imageScores.violence, videoScores.violence])),
    weapon: roundScore(maxScore([imageScores.weapon, videoScores.weapon])),
  };

  const finalAction = deriveFinalAction({
    scores: aggregateScores,
    textResult,
    imageResult,
    videoResult,
    pendingSources: normalizedPendingSources,
  });

  const evidence = mergeEvidence(
    textResult?.evidence || [],
    imageResult?.evidence || [],
    videoResult?.evidence || [],
  );
  const reasons = buildActionReasons({
    scores: aggregateScores,
    textResult,
    imageResult,
    videoResult,
    pendingSources: normalizedPendingSources,
  });
  const flaggedCategories = uniqueList([
    ...(textResult?.flaggedCategories || []),
    ...(imageResult?.flaggedCategories || []),
    ...(videoResult?.flaggedCategories || []),
  ]);
  const confidence = roundScore(
    maxScore([
      textResult?.confidence,
      imageResult?.confidence,
      videoResult?.confidence,
      maxScore(Object.values(aggregateScores)),
    ]),
  );
  const durationMs = Date.now() - startedAt;
  recordDuration('aggregate', durationMs);

  return {
    source: 'aggregate',
    finalAction,
    finalStatus: mapActionToPostStatus(finalAction),
    approved: finalAction === MODERATION_ACTIONS.APPROVE,
    requiresHumanReview: finalAction === MODERATION_ACTIONS.REVIEW,
    requiresAsyncScan: finalAction === MODERATION_ACTIONS.PENDING_SCAN,
    reasons,
    confidence,
    scores: aggregateScores,
    evidence,
    flagged: finalAction !== MODERATION_ACTIONS.APPROVE,
    flaggedCategories,
    moderationSources: uniqueList(
      [textResult?.source, imageResult?.source, videoResult?.source].filter(Boolean),
    ),
    pendingSources: normalizedPendingSources,
    durationMs,
    debug: includeDebug
      ? {
          textResult,
          imageResult,
          videoResult,
        }
      : undefined,
  };
}

module.exports = {
  aggregateModerationResults,
};
