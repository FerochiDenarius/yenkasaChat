const AIUsageLog = require('../models/aiUsageLog.model');
const { getProvider } = require('../providers');
const { resolveMode } = require('../utils/mode-config');
const { estimateUsage } = require('../utils/token-usage');

const SCAM_PATTERNS = [
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
];

const SEXUAL_PATTERNS = [
  /\bnude\b/i,
  /\bnudes\b/i,
  /\bsex video\b/i,
  /\bexplicit\b/i,
  /\badult content\b/i,
];

const HATE_PATTERNS = [
  /\bkill all\b/i,
  /\bwipe them out\b/i,
  /\bterrorist\b/i,
  /\bethnic cleansing\b/i,
];

const VIOLENCE_PATTERNS = [
  /\bkill\b/i,
  /\bmurder\b/i,
  /\bshoot\b/i,
  /\bstab\b/i,
  /\battack\b/i,
];

const SELF_HARM_PATTERNS = [
  /\bsuicide\b/i,
  /\bkill myself\b/i,
  /\bself harm\b/i,
  /\bhurt myself\b/i,
];

const SPAM_PATTERNS = [
  /\bfree\b.{0,20}\bclick\b/i,
  /\bearn money fast\b/i,
  /\bwork from home\b/i,
  /\blimited offer\b/i,
  /\bact now\b/i,
];

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, Number(numeric.toFixed(4))));
}

function roundScore(value) {
  return Number(clampScore(value).toFixed(2));
}

function normalizeList(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
}

function extractJsonBlock(answer) {
  const raw = String(answer || '').trim();
  if (!raw) return null;

  const candidates = [raw];
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.unshift(fencedMatch[1].trim());
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0].trim());
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_error) {}
  }

  return null;
}

function buildModerationPrompt({ text, imageUrls, videoUrl, audioUrl, userId }) {
  return [
    'You are the Yenkasa-AI moderation classifier.',
    'Your job is to classify social platform post content for safety review.',
    'Return JSON only. Do not wrap in markdown fences.',
    'You must decide whether content should be auto-approved or sent to human moderation.',
    'Classify for:',
    '- toxicity',
    '- spam',
    '- scams or fraud',
    '- hate speech',
    '- sexual or nudity risk',
    '- violence',
    '- self-harm risk',
    '',
    'Rules:',
    '- If content is clearly safe, approved must be true and riskLevel should be "low".',
    '- If content is suspicious, misleading, abusive, sexual, hateful, violent, or unsafe, approved must be false.',
    '- Use "medium" or "high" riskLevel when human review is needed.',
    '- You only have text and media URLs metadata. If the text is safe but media is present, do not invent visual findings.',
    '',
    'Return exactly this JSON shape:',
    '{"approved":true,"riskLevel":"low","toxicityScore":0.02,"spamScore":0.01,"scamScore":0.01,"sexualContentScore":0.0,"hateSpeechScore":0.0,"violenceScore":0.0,"selfHarmScore":0.0,"reason":"Safe content"}',
    '',
    `User ID: ${String(userId || '').trim() || 'unknown'}`,
    `Text: ${String(text || '').trim() || '(empty)'}`,
    `Image URLs: ${JSON.stringify(imageUrls || [])}`,
    `Video URL: ${String(videoUrl || '').trim() || ''}`,
    `Audio URL: ${String(audioUrl || '').trim() || ''}`,
  ].join('\n');
}

function collectHeuristicScores({ text, imageUrls, videoUrl, audioUrl }) {
  const normalizedText = String(text || '').trim();
  const lowered = normalizedText.toLowerCase();
  const triggers = [];

  let toxicityScore = 0;
  let spamScore = 0;
  let scamScore = 0;
  let sexualContentScore = 0;
  let hateSpeechScore = 0;
  let violenceScore = 0;
  let selfHarmScore = 0;

  const urlCount =
    (normalizedText.match(/https?:\/\/|www\./gi) || []).length +
    normalizeList(imageUrls).length +
    (videoUrl ? 1 : 0) +
    (audioUrl ? 1 : 0);

  if (urlCount >= 3) {
    spamScore = Math.max(spamScore, 0.58);
    triggers.push('multiple_links');
  }

  if (/(?:\+?\d[\d\s\-]{7,}\d)/.test(normalizedText)) {
    spamScore = Math.max(spamScore, 0.36);
    triggers.push('phone_number');
  }

  if (/([!?.,])\1{4,}/.test(normalizedText) || /(.)\1{7,}/.test(lowered)) {
    spamScore = Math.max(spamScore, 0.28);
    triggers.push('repetition');
  }

  if ((normalizedText.match(/#/g) || []).length >= 8) {
    spamScore = Math.max(spamScore, 0.22);
    triggers.push('hashtag_stuffing');
  }

  if (SPAM_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    spamScore = Math.max(spamScore, 0.55);
    triggers.push('spam_pattern');
  }

  if (SCAM_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    scamScore = Math.max(scamScore, 0.92);
    spamScore = Math.max(spamScore, 0.74);
    toxicityScore = Math.max(toxicityScore, 0.32);
    triggers.push('scam_pattern');
  }

  if (SEXUAL_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    sexualContentScore = Math.max(sexualContentScore, 0.88);
    triggers.push('sexual_pattern');
  }

  if (HATE_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    hateSpeechScore = Math.max(hateSpeechScore, 0.94);
    toxicityScore = Math.max(toxicityScore, 0.9);
    triggers.push('hate_pattern');
  }

  if (VIOLENCE_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    violenceScore = Math.max(violenceScore, 0.7);
    toxicityScore = Math.max(toxicityScore, 0.58);
    triggers.push('violence_pattern');
  }

  if (SELF_HARM_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    selfHarmScore = Math.max(selfHarmScore, 0.78);
    toxicityScore = Math.max(toxicityScore, 0.45);
    triggers.push('self_harm_pattern');
  }

  const mediaAttached = normalizeList(imageUrls).length > 0 || Boolean(videoUrl) || Boolean(audioUrl);

  return {
    toxicityScore: clampScore(toxicityScore),
    spamScore: clampScore(spamScore),
    scamScore: clampScore(scamScore),
    sexualContentScore: clampScore(sexualContentScore),
    hateSpeechScore: clampScore(hateSpeechScore),
    violenceScore: clampScore(violenceScore),
    selfHarmScore: clampScore(selfHarmScore),
    triggers,
    mediaAttached,
  };
}

function normalizeAiScores(rawDecision = {}) {
  return {
    toxicityScore: clampScore(rawDecision.toxicityScore),
    spamScore: clampScore(rawDecision.spamScore),
    scamScore: clampScore(rawDecision.scamScore),
    sexualContentScore: clampScore(rawDecision.sexualContentScore),
    hateSpeechScore: clampScore(rawDecision.hateSpeechScore),
    violenceScore: clampScore(rawDecision.violenceScore),
    selfHarmScore: clampScore(rawDecision.selfHarmScore),
  };
}

function classifyRisk(scores) {
  const values = Object.values(scores).map((value) => clampScore(value));
  const maxScore = values.length ? Math.max(...values) : 0;

  if (maxScore >= 0.78) return 'high';
  if (maxScore >= 0.4) return 'medium';
  return 'low';
}

function pickReason(scores, fallbackReason = '', triggers = []) {
  if (scores.scamScore >= 0.55) return 'Possible scam or spam detected';
  if (scores.hateSpeechScore >= 0.55) return 'Possible hate or abusive content detected';
  if (scores.sexualContentScore >= 0.55) return 'Possible sexual or nudity-related content detected';
  if (scores.violenceScore >= 0.55) return 'Possible violent content detected';
  if (scores.selfHarmScore >= 0.55) return 'Possible self-harm content detected';
  if (scores.toxicityScore >= 0.55) return 'Possible toxic or unsafe content detected';
  if (scores.spamScore >= 0.4) return 'Possible spam detected';
  if (fallbackReason) return fallbackReason;
  if (triggers.length) return `Flagged by moderation signals: ${triggers.join(', ')}`;
  return 'Safe content';
}

function normalizeModerationDecision({ heuristicScores, aiDecision, providerError }) {
  const heuristicNumericScores = {
    toxicityScore: heuristicScores.toxicityScore,
    spamScore: heuristicScores.spamScore,
    scamScore: heuristicScores.scamScore,
    sexualContentScore: heuristicScores.sexualContentScore,
    hateSpeechScore: heuristicScores.hateSpeechScore,
    violenceScore: heuristicScores.violenceScore,
    selfHarmScore: heuristicScores.selfHarmScore,
  };
  const mergedScores = {
    ...heuristicNumericScores,
    ...Object.fromEntries(
      Object.entries(normalizeAiScores(aiDecision || {})).map(([key, value]) => [
        key,
        Math.max(value, heuristicNumericScores[key] || 0),
      ]),
    ),
  };

  const riskLevel = providerError ? 'high' : classifyRisk(mergedScores);
  const approved =
    !providerError &&
    riskLevel === 'low' &&
    (aiDecision?.approved !== false);

  const reason = providerError
    ? 'AI moderation unavailable, routed to human review'
    : pickReason(
        mergedScores,
        String(aiDecision?.reason || '').trim(),
        heuristicScores.triggers,
      );

  return {
    approved,
    riskLevel,
    toxicityScore: roundScore(mergedScores.toxicityScore),
    spamScore: roundScore(mergedScores.spamScore),
    scamScore: roundScore(mergedScores.scamScore),
    sexualContentScore: roundScore(mergedScores.sexualContentScore),
    hateSpeechScore: roundScore(mergedScores.hateSpeechScore),
    violenceScore: roundScore(mergedScores.violenceScore),
    selfHarmScore: roundScore(mergedScores.selfHarmScore),
    reason,
    requiresHumanReview: !approved,
    mediaInspectionLimited: Boolean(heuristicScores.mediaAttached),
  };
}

async function safeLogUsage(payload) {
  try {
    await AIUsageLog.create(payload);
  } catch (error) {
    console.warn('[AIModeration] Failed to write usage log:', error.message);
  }
}

async function moderatePostContent({
  text = '',
  imageUrls = [],
  videoUrl = '',
  audioUrl = '',
  userId,
  includeDebug = false,
  source = 'api',
}) {
  const modeConfig = resolveMode('moderation');
  const provider = getProvider(modeConfig.provider);
  const normalizedPayload = {
    text: String(text || '').trim(),
    imageUrls: normalizeList(imageUrls),
    videoUrl: String(videoUrl || '').trim(),
    audioUrl: String(audioUrl || '').trim(),
    userId: String(userId || '').trim(),
  };

  const prompt = buildModerationPrompt(normalizedPayload);
  const heuristicScores = collectHeuristicScores(normalizedPayload);
  const startedAt = Date.now();

  let providerResponse = null;
  let aiDecision = null;
  let providerError = null;

  try {
    providerResponse = await provider.chat({
      question: prompt,
      history: [],
      audience: modeConfig.audience,
      includeDebug,
    });
    aiDecision = extractJsonBlock(providerResponse?.answer || '');
  } catch (error) {
    providerError = error;
  }

  const moderationDecision = normalizeModerationDecision({
    heuristicScores,
    aiDecision,
    providerError,
  });

  const usage = estimateUsage({
    prompt,
    answer: providerResponse?.answer || JSON.stringify(moderationDecision),
    sources: providerResponse?.sources || [],
  });

  await safeLogUsage({
    userId,
    mode: modeConfig.mode,
    provider: provider.name,
    endpoint: '/api/ai/moderate',
    success: !providerError,
    model: providerResponse?.model || '',
    latencyMs: Date.now() - startedAt,
    ...usage,
    metadata: {
      source,
      engineAudience: modeConfig.audience,
      riskLevel: moderationDecision.riskLevel,
      approved: moderationDecision.approved,
      reason: moderationDecision.reason,
      heuristicScores,
      providerError: providerError ? providerError.message : null,
      engineTimings: providerResponse?.timings || {},
      engineSources: providerResponse?.sources || [],
    },
  });

  return {
    ...moderationDecision,
    provider: provider.name,
    mode: modeConfig.mode,
    debug: includeDebug
      ? {
          heuristicScores,
          aiDecision,
          providerError: providerError ? providerError.message : null,
          engineDebug: providerResponse?.debug || null,
        }
      : undefined,
  };
}

module.exports = {
  moderatePostContent,
};
