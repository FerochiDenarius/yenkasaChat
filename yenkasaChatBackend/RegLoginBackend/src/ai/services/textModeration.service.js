const { getPipeline } = require('../utils/transformersRuntime');
const { getThresholds, MODERATION_ACTIONS } = require('./moderationThresholds');
const {
  buildTextExcerpt,
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

const CATEGORY_LABELS = Object.freeze({
  toxicity: 'toxic or abusive language',
  hate: 'hate speech or identity attack',
  spam: 'spam or engagement bait',
  scam: 'scam, fraud, or payment deception',
  harassment: 'harassment or bullying',
  safe: 'safe everyday conversation',
});

const HEURISTIC_PATTERNS = Object.freeze({
  scam: [
    /\bdouble your money\b/i,
    /\bguaranteed profit\b/i,
    /\binvest now\b/i,
    /\bquick cash\b/i,
    /\bforex signal\b/i,
    /\bcrypto signal\b/i,
    /\bwhatsapp me\b/i,
    /\bdm me for payment\b/i,
    /\bsend (me )?money\b/i,
    /\bpayment proof\b/i,
  ],
  hate: [
    /\bkill all\b/i,
    /\bwipe them out\b/i,
    /\bethnic cleansing\b/i,
    /\bterrorist(s)?\b/i,
  ],
  harassment: [
    /\byou are useless\b/i,
    /\byou are stupid\b/i,
    /\bgo die\b/i,
    /\bi will destroy you\b/i,
  ],
  toxicity: [
    /\bidiot\b/i,
    /\btrash\b/i,
    /\bkill\b/i,
    /\bmurder\b/i,
    /\bshoot\b/i,
    /\bstab\b/i,
    /\battack\b/i,
  ],
  spam: [
    /\bfree\b.{0,20}\bclick\b/i,
    /\bearn money fast\b/i,
    /\bwork from home\b/i,
    /\blimited offer\b/i,
    /\bact now\b/i,
  ],
});

const DEFAULT_MODEL = process.env.YENKASA_TEXT_MODERATION_MODEL || 'Xenova/distilbert-base-uncased-mnli';

function buildBaseScores() {
  return {
    toxicity: 0,
    hate: 0,
    spam: 0,
    scam: 0,
    harassment: 0,
    safe: 0,
  };
}

function findHeuristicMatches(text) {
  const normalized = String(text || '').trim();
  const scores = buildBaseScores();
  const matchesByCategory = {};
  const evidence = [];

  for (const [category, patterns] of Object.entries(HEURISTIC_PATTERNS)) {
    const matches = patterns
      .map((pattern) => normalized.match(pattern)?.[0] || '')
      .filter(Boolean);

    if (!matches.length) continue;

    matchesByCategory[category] = uniqueList(matches);

    switch (category) {
      case 'scam':
        scores.scam = Math.max(scores.scam, 0.92);
        scores.spam = Math.max(scores.spam, 0.74);
        scores.toxicity = Math.max(scores.toxicity, 0.28);
        break;
      case 'hate':
        scores.hate = Math.max(scores.hate, 0.94);
        scores.toxicity = Math.max(scores.toxicity, 0.9);
        break;
      case 'harassment':
        scores.harassment = Math.max(scores.harassment, 0.88);
        scores.toxicity = Math.max(scores.toxicity, 0.78);
        break;
      case 'toxicity':
        scores.toxicity = Math.max(scores.toxicity, 0.72);
        break;
      case 'spam':
        scores.spam = Math.max(scores.spam, 0.58);
        break;
      default:
        break;
    }
  }

  const urlCount = (normalized.match(/https?:\/\/|www\./gi) || []).length;
  const phoneNumberMatch = normalized.match(/(?:\+?\d[\d\s\-]{7,}\d)/);
  const excessiveRepeats = /([!?.,])\1{4,}/.test(normalized) || /(.)\1{7,}/.test(normalized.toLowerCase());
  const hashtagCount = (normalized.match(/#/g) || []).length;

  if (urlCount >= 3) {
    scores.spam = Math.max(scores.spam, 0.58);
    matchesByCategory.spam = uniqueList([...(matchesByCategory.spam || []), 'multiple_links']);
  }

  if (phoneNumberMatch) {
    scores.spam = Math.max(scores.spam, 0.36);
    matchesByCategory.spam = uniqueList([...(matchesByCategory.spam || []), phoneNumberMatch[0]]);
  }

  if (excessiveRepeats) {
    scores.spam = Math.max(scores.spam, 0.28);
    matchesByCategory.spam = uniqueList([...(matchesByCategory.spam || []), 'repetition']);
  }

  if (hashtagCount >= 8) {
    scores.spam = Math.max(scores.spam, 0.22);
    matchesByCategory.spam = uniqueList([...(matchesByCategory.spam || []), 'hashtag_stuffing']);
  }

  for (const [category, matches] of Object.entries(matchesByCategory)) {
    evidence.push({
      type: 'text',
      source: 'heuristic',
      category,
      score: scores[category] || scores.toxicity || 0,
      excerpt: buildTextExcerpt(normalized, matches),
      matches,
    });
  }

  return {
    scores,
    evidence,
    matchesByCategory,
  };
}

function toScoreMap(rawOutput) {
  const scores = buildBaseScores();
  const labels = Array.isArray(rawOutput?.labels) ? rawOutput.labels : [];
  const values = Array.isArray(rawOutput?.scores) ? rawOutput.scores : [];

  labels.forEach((label, index) => {
    const matchingEntry = Object.entries(CATEGORY_LABELS).find(([, candidateLabel]) => candidateLabel === label);
    if (!matchingEntry) return;
    const [category] = matchingEntry;
    scores[category] = clampScore(values[index]);
  });

  return scores;
}

async function runZeroShotClassification(text) {
  if (!String(text || '').trim()) {
    return {
      model: DEFAULT_MODEL,
      scores: buildBaseScores(),
      raw: null,
      error: null,
    };
  }

  try {
    const classifier = await getPipeline(
      'zero-shot-classification',
      DEFAULT_MODEL,
    );
    recordModelUsage(DEFAULT_MODEL);

    const candidateLabels = Object.values(CATEGORY_LABELS);

    let raw = null;
    try {
      raw = await classifier(String(text), candidateLabels, { multi_label: true });
    } catch (_firstError) {
      raw = await classifier(String(text), {
        candidate_labels: candidateLabels,
        multi_label: true,
      });
    }

    return {
      model: DEFAULT_MODEL,
      scores: toScoreMap(raw),
      raw,
      error: null,
    };
  } catch (error) {
    return {
      model: DEFAULT_MODEL,
      scores: buildBaseScores(),
      raw: null,
      error,
    };
  }
}

function determineAction(scores) {
  const thresholds = getThresholds();

  const rejectHit =
    scores.toxicity >= thresholds.text.reject.toxicity ||
    scores.hate >= thresholds.text.reject.hate ||
    scores.scam >= thresholds.text.reject.scam ||
    scores.harassment >= thresholds.text.reject.harassment;

  if (rejectHit) return MODERATION_ACTIONS.REJECT;

  const reviewHit =
    scores.toxicity >= thresholds.text.review.toxicity ||
    scores.hate >= thresholds.text.review.hate ||
    scores.spam >= thresholds.text.review.spam ||
    scores.scam >= thresholds.text.review.scam ||
    scores.harassment >= thresholds.text.review.harassment;

  if (reviewHit) return MODERATION_ACTIONS.REVIEW;
  return MODERATION_ACTIONS.APPROVE;
}

function buildReasons(scores) {
  const reasons = [];
  if (scores.scam >= 0.55) reasons.push('Potential scam or payment fraud');
  if (scores.hate >= 0.55) reasons.push('Potential hate speech or identity attack');
  if (scores.harassment >= 0.55) reasons.push('Potential harassment or bullying');
  if (scores.toxicity >= 0.55) reasons.push('Potential toxic or abusive language');
  if (scores.spam >= 0.5) reasons.push('Potential spam or engagement bait');
  return reasons;
}

async function moderateTextContent({ text = '', includeDebug = false } = {}) {
  const startedAt = Date.now();
  const normalizedText = String(text || '').trim();

  if (!normalizedText) {
    return {
      source: 'text',
      model: DEFAULT_MODEL,
      scores: buildBaseScores(),
      confidence: 1,
      flagged: false,
      recommendedAction: MODERATION_ACTIONS.APPROVE,
      reasons: [],
      evidence: [],
      durationMs: 0,
      debug: includeDebug ? { heuristics: null, hf: null, fallback: true } : undefined,
    };
  }

  const heuristicResult = findHeuristicMatches(normalizedText);
  const hfResult = await runZeroShotClassification(normalizedText);

  const mergedScores = Object.fromEntries(
    Object.keys(buildBaseScores()).map((category) => [
      category,
      roundScore(
        Math.max(
          heuristicResult.scores[category] || 0,
          hfResult.scores[category] || 0,
        ),
      ),
    ]),
  );

  const recommendedAction = determineAction(mergedScores);
  const reasons = buildReasons(mergedScores);
  const flaggedCategories = Object.entries(mergedScores)
    .filter(([category, score]) => category !== 'safe' && score >= 0.5)
    .map(([category]) => category);
  const durationMs = Date.now() - startedAt;
  const confidence = roundScore(
    maxScore([
      mergedScores.toxicity,
      mergedScores.hate,
      mergedScores.spam,
      mergedScores.scam,
      mergedScores.harassment,
      1 - mergedScores.safe,
    ]),
  );

  const evidence = [
    ...heuristicResult.evidence,
    ...flaggedCategories.map((category) => ({
      type: 'text',
      source: hfResult.error ? 'heuristic_fallback' : 'hf_zero_shot',
      category,
      score: mergedScores[category],
      excerpt: truncateForEvidence(normalizedText),
      matches: normalizeList(heuristicResult.matchesByCategory[category]),
    })),
  ];

  recordDuration('text', durationMs);

  return {
    source: 'text',
    model: hfResult.model,
    scores: mergedScores,
    confidence,
    flagged: recommendedAction !== MODERATION_ACTIONS.APPROVE,
    recommendedAction,
    reasons,
    flaggedCategories,
    evidence,
    durationMs,
    debug: includeDebug
      ? {
          heuristics: heuristicResult,
          hf: hfResult.raw,
          hfError: hfResult.error ? hfResult.error.message : null,
        }
      : undefined,
  };
}

function truncateForEvidence(text) {
  return buildTextExcerpt(text, [], 220);
}

module.exports = {
  CATEGORY_LABELS,
  moderateTextContent,
};
