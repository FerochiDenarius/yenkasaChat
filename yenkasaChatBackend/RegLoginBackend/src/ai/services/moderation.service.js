const AIUsageLog = require('../models/aiUsageLog.model');
const { buildLegacyModerationSummary, preparePostModeration } = require('./moderationWorkflow.service');

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
  imageFilePaths = [],
  videoUrl = '',
  audioUrl = '',
  userId,
  includeDebug = false,
  source = 'api',
} = {}) {
  const startedAt = Date.now();
  const moderationPlan = await preparePostModeration({
    text,
    imageUrls,
    imageFilePaths,
    videoUrl,
    audioUrl,
    userId,
    includeDebug,
    queueEnabled: false,
  });

  const legacySummary = buildLegacyModerationSummary({
    aggregate: moderationPlan.aggregate,
    textResult: moderationPlan.textResult,
    imageResult: moderationPlan.imageResult,
    videoResult: moderationPlan.videoResult,
  });

  await safeLogUsage({
    userId,
    mode: 'phase1_multimodal',
    provider: 'huggingface_local',
    endpoint: '/api/ai/moderate',
    success: true,
    model: [
      moderationPlan.textResult?.model,
      ...(moderationPlan.imageResult?.models || []),
      moderationPlan.videoResult?.model,
    ]
      .filter(Boolean)
      .join(','),
    latencyMs: Date.now() - startedAt,
    estimatedPromptTokens: 0,
    estimatedCompletionTokens: 0,
    estimatedTotalTokens: 0,
    estimatedCostUsd: 0,
    metadata: {
      source,
      finalAction: moderationPlan.aggregate.finalAction,
      finalStatus: moderationPlan.aggregate.finalStatus,
      confidence: moderationPlan.aggregate.confidence,
      reasons: moderationPlan.aggregate.reasons,
      moderationSources: moderationPlan.aggregate.moderationSources,
      pendingSources: moderationPlan.aggregate.pendingSources,
    },
  });

  return {
    ...legacySummary,
    textResult: moderationPlan.textResult,
    imageResult: moderationPlan.imageResult,
    videoResult: moderationPlan.videoResult,
    aggregate: moderationPlan.aggregate,
    debug: includeDebug
      ? {
          moderationPlan,
        }
      : undefined,
  };
}

module.exports = {
  moderatePostContent,
};
