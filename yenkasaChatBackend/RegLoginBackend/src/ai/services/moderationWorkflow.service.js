const { v4: uuidv4 } = require('uuid');

const AiModeration = require('../../../models/aiModeration.model');
const ModerationItem = require('../../../models/ModerationItem.model');
const Post = require('../../../models/post.model');
const PostApproval = require('../../../models/postapproval.model');
const User = require('../../../models/user.model');
const { SYSTEM_USER_ID } = require('../../../config/system');
const { sendNotification } = require('../../../services/notification.service');
const {
  emitApprovedPostCreated,
} = require('../../../services/postEventPublisher.service');
const { queueCommunityPostNotifications } = require('../../../services/communityPostNotification.service');
const rewardService = require('../../../services/reward.service');

const { moderateTextContent } = require('./textModeration.service');
const { moderateImageBatch } = require('./imageModeration.service');
const { moderateVideoPlaceholder } = require('./videoModeration.service');
const { aggregateModerationResults } = require('./moderationAggregator.service');
const {
  MODERATION_ACTIONS,
  POST_STATUSES,
  mapActionToPostStatus,
} = require('./moderationThresholds');
const {
  clampScore,
  maxScore,
  normalizeList,
  roundScore,
  uniqueList,
} = require('./moderationUtils');
const {
  incrementCounter,
  recordDuration,
} = require('./moderationMetrics.service');

const APPROVER_ROLE_NAMES = ['admin', 'moderator', 'junior_developer', 'senior_developer'];
const APPROVER_ACCESS_ROLES = ['ADMIN', 'MODERATOR', 'JUNIOR_DEVELOPER', 'SENIOR_DEVELOPER'];
const CREATE_POST_REWARD = 20;

function classifyRisk(scores = {}) {
  const highest = maxScore([
    scores.toxicity,
    scores.harassment,
    scores.spam,
    scores.scam,
    scores.hate,
    scores.nudity,
    scores.violence,
    scores.weapon,
  ]);

  if (highest >= 0.78) return 'high';
  if (highest >= 0.4) return 'medium';
  return 'low';
}

function buildLegacyModerationSummary({
  aggregate,
  textResult = null,
  imageResult = null,
  videoResult = null,
}) {
  const scores = aggregate?.scores || {};
  const riskLevel = classifyRisk(scores);
  const reason = aggregate?.reasons?.[0] || (aggregate?.approved ? 'Safe content' : 'Flagged by moderation');

  return {
    approved: aggregate?.finalAction === MODERATION_ACTIONS.APPROVE,
    riskLevel,
    toxicityScore: roundScore(scores.toxicity),
    spamScore: roundScore(scores.spam),
    scamScore: roundScore(scores.scam),
    sexualContentScore: roundScore(scores.nudity),
    hateSpeechScore: roundScore(scores.hate),
    violenceScore: roundScore(scores.violence),
    harassmentScore: roundScore(scores.harassment),
    weaponScore: roundScore(scores.weapon),
    reason,
    requiresHumanReview: aggregate?.finalAction === MODERATION_ACTIONS.REVIEW,
    requiresAsyncScan: aggregate?.finalAction === MODERATION_ACTIONS.PENDING_SCAN,
    finalAction: aggregate?.finalAction,
    finalStatus: aggregate?.finalStatus,
    confidence: clampScore(aggregate?.confidence),
    flaggedCategories: aggregate?.flaggedCategories || [],
    moderationSources: aggregate?.moderationSources || [],
    pendingSources: aggregate?.pendingSources || [],
    evidence: aggregate?.evidence || [],
    mediaInspectionLimited: Boolean(
      aggregate?.pendingSources?.length ||
        videoResult ||
        (imageResult && !imageResult?.items?.length && imageResult?.recommendedAction === MODERATION_ACTIONS.PENDING_SCAN),
    ),
    text: textResult ? textResult.scores : null,
    image: imageResult
      ? {
          safe: imageResult.safe,
          nudity: imageResult.nudity,
          violence: imageResult.violence,
          weapon: imageResult.weapon,
          hate: imageResult.hate,
          scam: imageResult.scam,
        }
      : null,
    video: videoResult || null,
    provider: 'huggingface_local',
    mode: 'phase1_multimodal',
  };
}

function buildDeferredImageReviewResult(reason) {
  return {
    source: 'image',
    models: [],
    safe: 1,
    nudity: 0,
    violence: 0,
    weapon: 0,
    hate: 0,
    scam: 0,
    confidence: 0,
    flagged: false,
    recommendedAction: MODERATION_ACTIONS.REVIEW,
    reasons: reason ? [reason] : [],
    flaggedCategories: [],
    evidence: [],
    durationMs: 0,
    items: [],
  };
}

function recordActionMetrics(action) {
  incrementCounter('totalRequests');

  switch (action) {
    case MODERATION_ACTIONS.APPROVE:
      incrementCounter('approvedPosts');
      break;
    case MODERATION_ACTIONS.REVIEW:
      incrementCounter('reviewPosts');
      incrementCounter('flaggedPosts');
      break;
    case MODERATION_ACTIONS.REJECT:
      incrementCounter('rejectedPosts');
      incrementCounter('flaggedPosts');
      break;
    case MODERATION_ACTIONS.PENDING_SCAN:
      incrementCounter('pendingScanPosts');
      break;
    default:
      break;
  }
}

async function getApprovers() {
  return User.find({
    $or: [
      { roleName: { $in: APPROVER_ROLE_NAMES } },
      { accessRole: { $in: APPROVER_ACCESS_ROLES } },
      { staffRole: { $in: APPROVER_ROLE_NAMES } },
    ],
  }).select('_id username playerId');
}

async function notifyCreatorPostUnderReview(post) {
  await sendNotification({
    type: 'post_under_review',
    senderId: SYSTEM_USER_ID,
    receiverId: post.userId,
    activityId: post._id.toString(),
    targetType: 'post',
    targetId: post._id.toString(),
    message: 'Your post is under review and will be approved shortly.',
    push: true,
    pushTitle: 'Post under review',
    pushBody: 'Your post was flagged for review and is waiting for a moderator.',
  });
}

async function notifyApprovers(post) {
  const approvers = await getApprovers();

  await Promise.all(
    approvers.map((moderator) =>
      sendNotification({
        type: 'post_pending',
        senderId: post.userId,
        receiverId: moderator._id,
        activityId: post._id.toString(),
        targetType: 'post',
        targetId: post._id.toString(),
        message: 'A new post is awaiting approval.',
        push: true,
        pushTitle: 'Pending Post',
        pushBody: 'A new post requires moderation review.',
        pushData: {
          postId: post._id.toString(),
          targetType: 'post',
          targetId: post._id.toString(),
        },
      }),
    ),
  );
}

async function notifyCreatorAutoRejected(post, aiModeration) {
  await sendNotification({
    type: 'post_rejected',
    senderId: SYSTEM_USER_ID,
    receiverId: post.userId,
    activityId: `ai_rejected_${post._id}_${uuidv4()}`,
    targetType: 'post',
    targetId: post._id.toString(),
    message: aiModeration?.reason || 'Your post was rejected by Yenkasa AI moderation.',
    push: true,
    pushTitle: 'Post rejected',
    pushBody: aiModeration?.reason || 'Your post did not pass AI moderation.',
    pushData: {
      postId: post._id.toString(),
      targetType: 'post',
      targetId: post._id.toString(),
    },
  });
}

async function rewardAndPublishApprovedPost(post, source, requestId = '') {
  await rewardService.reward(post.userId, CREATE_POST_REWARD, {
    type: 'REWARD_POST',
    description: `Earned ${CREATE_POST_REWARD} YKC for creating a post`,
    relatedPostId: post._id,
    activityId: `create_post_${post._id}_${post.userId}`,
  });

  await emitApprovedPostCreated(post._id, source, requestId);
  queueCommunityPostNotifications({ postId: post._id });
}

async function syncPostApprovalArtifacts(post, aiModeration, reqContext = {}) {
  let approvalEntry = await PostApproval.findOne({ post: post._id });
  const isNewApproval = !approvalEntry;

  if (!approvalEntry) {
    approvalEntry = await PostApproval.create({
      post: post._id,
      user: post.userId,
      caption: post.text,
      textBackgroundColor: post.textBackgroundColor || '',
      imageUrl: post.imageUrl || '',
      imageUrls: post.imageUrls || [],
      videoUrl: post.videoUrl || '',
      audioUrl: post.audioUrl || '',
      submittedAt: post.createdAt || new Date(),
      status: 'pending',
      aiModeration,
    });
  } else {
    approvalEntry.caption = post.text;
    approvalEntry.textBackgroundColor = post.textBackgroundColor || '';
    approvalEntry.imageUrl = post.imageUrl || '';
    approvalEntry.imageUrls = post.imageUrls || [];
    approvalEntry.videoUrl = post.videoUrl || '';
    approvalEntry.audioUrl = post.audioUrl || '';
    approvalEntry.aiModeration = aiModeration;
    approvalEntry.status = approvalEntry.status === 'rejected' ? 'pending' : approvalEntry.status;
    approvalEntry.submittedAt = approvalEntry.submittedAt || new Date();
    await approvalEntry.save();
  }

  let moderationItem = await ModerationItem.findOne({
    type: 'system_flag',
    targetPostId: post._id,
    status: 'pending',
  });

  if (!moderationItem) {
    moderationItem = await ModerationItem.create({
      type: 'system_flag',
      targetUserId: post.userId,
      targetPostId: post._id,
      reportedBy: post.userId,
      reason: aiModeration.reason || 'Flagged by Yenkasa AI moderation',
      status: 'pending',
      metadata: {
        source: 'yenkasa_ai_phase1',
        moderation: aiModeration,
        communityId: post.communityId,
        communityName: post.communityName,
        visibility: post.visibility || 'public',
        postType: post.postType,
      },
      createdBy: 'system',
      ipAddress: reqContext.ipAddress || null,
    });
  } else {
    moderationItem.reason = aiModeration.reason || moderationItem.reason;
    moderationItem.metadata = {
      ...(moderationItem.metadata || {}),
      moderation: aiModeration,
      communityId: post.communityId,
      communityName: post.communityName,
      visibility: post.visibility || 'public',
      postType: post.postType,
    };
    await moderationItem.save();
  }

  if (isNewApproval) {
    await notifyCreatorPostUnderReview(post);
    await notifyApprovers(post);
  }

  return {
    approvalEntry,
    moderationItem,
  };
}

async function upsertAiModerationRecord({
  post,
  textResult = null,
  imageResult = null,
  videoResult = null,
  aggregate,
  lifecycleStatus = 'completed',
  queueUpdate = {},
  metadata = {},
}) {
  const legacySummary = buildLegacyModerationSummary({
    aggregate,
    textResult,
    imageResult,
    videoResult,
  });

  const payload = {
    postId: post._id,
    userId: post.userId,
    lifecycleStatus,
    finalAction: aggregate.finalAction,
    moderationSources: aggregate.moderationSources || [],
    flaggedCategories: aggregate.flaggedCategories || [],
    sourceResults: {
      text: textResult || null,
      image: imageResult || null,
      video: videoResult || null,
      aggregate,
    },
    evidence: {
      reasons: aggregate.reasons || [],
      items: aggregate.evidence || [],
      pendingSources: aggregate.pendingSources || [],
    },
    metrics: {
      totalDurationMs:
        (textResult?.durationMs || 0) +
        (imageResult?.durationMs || 0) +
        (videoResult?.durationMs || 0) +
        (aggregate?.durationMs || 0),
      textDurationMs: textResult?.durationMs || 0,
      imageDurationMs: imageResult?.durationMs || 0,
      videoDurationMs: videoResult?.durationMs || 0,
      queueWaitMs: queueUpdate.queueWaitMs || 0,
      queueProcessingMs: queueUpdate.queueProcessingMs || 0,
      flaggedCount: (aggregate.flaggedCategories || []).length,
      accuracyOutcome:
        aggregate.finalAction === MODERATION_ACTIONS.PENDING_SCAN
          ? 'pending_human_feedback'
          : aggregate.finalAction === MODERATION_ACTIONS.APPROVE
            ? 'not_applicable'
            : 'pending_human_feedback',
      createdAtMs: Date.now(),
      completedAtMs: lifecycleStatus === 'completed' || lifecycleStatus === 'reviewed' ? Date.now() : 0,
    },
    modelVersions: {
      text: textResult?.model || '',
      image: Array.isArray(imageResult?.models) ? imageResult.models.join(',') : imageResult?.model || '',
      video: videoResult?.model || '',
    },
    metadata: {
      ...metadata,
      postStatus: mapActionToPostStatus(aggregate.finalAction),
      legacySummary,
    },
  };

  if (queueUpdate.image) payload.queue = { ...(payload.queue || {}), image: queueUpdate.image };
  if (queueUpdate.video) payload.queue = { ...(payload.queue || {}), video: queueUpdate.video };

  const record = await AiModeration.findOneAndUpdate(
    { postId: post._id },
    {
      $set: payload,
      $setOnInsert: {
        reviewedBy: null,
        reviewedAt: null,
        moderatorDecision: null,
        moderatorReason: '',
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  post.aiModeration = legacySummary;
  post.aiModerationRef = record._id;
  post.status = mapActionToPostStatus(aggregate.finalAction);
  await post.save();

  return {
    record,
    legacySummary,
  };
}

async function preparePostModeration({
  text = '',
  imageUrls = [],
  imageFilePaths = [],
  videoUrl = '',
  audioUrl = '',
  userId,
  includeDebug = false,
  queueEnabled = false,
} = {}) {
  const workflowStartedAt = Date.now();
  const normalizedImageUrls = normalizeList(imageUrls);
  const normalizedImagePaths = normalizeList(imageFilePaths);
  const normalizedVideoUrl = String(videoUrl || '').trim();
  const normalizedAudioUrl = String(audioUrl || '').trim();

  const textResult = await moderateTextContent({ text, includeDebug });
  let imageResult = null;
  let videoResult = null;
  let pendingSources = [];
  let shouldQueueImage = false;
  let shouldQueueVideo = false;

  const hasImage = normalizedImageUrls.length > 0 || normalizedImagePaths.length > 0;
  const hasVideoOrAudio = Boolean(normalizedVideoUrl || normalizedAudioUrl);

  if (hasImage) {
    if (textResult.recommendedAction === MODERATION_ACTIONS.REJECT) {
      imageResult = buildDeferredImageReviewResult(
        'Image moderation skipped because text content was already rejected.',
      );
    } else if (queueEnabled) {
      shouldQueueImage = true;
      pendingSources.push('image');
    } else {
      console.warn('[POST_MODERATION_FALLBACK]', {
        source: 'image',
        reason: 'queue_unavailable',
        userId: userId ? String(userId) : '',
      });
      imageResult = buildDeferredImageReviewResult(
        'Image moderation queue unavailable, routed to human review.',
      );
    }
  }

  if (hasVideoOrAudio) {
    shouldQueueVideo = true;
    pendingSources.push(normalizedVideoUrl ? 'video' : 'audio');
    videoResult = await moderateVideoPlaceholder({
      videoUrl: normalizedVideoUrl,
      audioUrl: normalizedAudioUrl,
    });
  }

  let aggregate = await aggregateModerationResults({
    textResult,
    imageResult,
    videoResult,
    pendingSources,
    includeDebug,
  });

  if (
    hasVideoOrAudio &&
    aggregate.finalAction !== MODERATION_ACTIONS.REJECT
  ) {
    // Phase 1 keeps non-rejected video/audio posts in scan state until a real temporal pipeline exists.
    aggregate = {
      ...aggregate,
      finalAction: MODERATION_ACTIONS.PENDING_SCAN,
      finalStatus: POST_STATUSES.PENDING_SCAN,
      approved: false,
      requiresHumanReview: false,
      requiresAsyncScan: true,
    };
  }

  const durationMs = Date.now() - workflowStartedAt;
  recordDuration('workflow', durationMs);

  return {
    textResult,
    imageResult,
    videoResult,
    aggregate,
    shouldQueueImage,
    shouldQueueVideo,
    durationMs,
  };
}

async function initializePostModeration({
  post,
  moderationPlan,
  reqContext = {},
  queueImageResult = null,
  queueVideoResult = null,
}) {
  const queueUpdate = {};
  if (queueImageResult) {
    queueUpdate.image = {
      queueName: queueImageResult.queueName || '',
      jobId: String(queueImageResult.jobId || ''),
      state: queueImageResult.queued ? 'queued' : 'failed',
      enqueuedAt: queueImageResult.queued ? new Date() : null,
      failedAt: queueImageResult.queued ? null : new Date(),
      lastError: queueImageResult.queued ? '' : queueImageResult.reason || '',
    };
  }

  if (queueVideoResult) {
    queueUpdate.video = {
      queueName: queueVideoResult.queueName || '',
      jobId: String(queueVideoResult.jobId || ''),
      state: queueVideoResult.queued ? 'queued' : 'failed',
      enqueuedAt: queueVideoResult.queued ? new Date() : null,
      failedAt: queueVideoResult.queued ? null : new Date(),
      lastError: queueVideoResult.queued ? '' : queueVideoResult.reason || '',
    };
  }

  const lifecycleStatus =
    moderationPlan.aggregate.finalAction === MODERATION_ACTIONS.PENDING_SCAN
      ? 'queued'
      : 'completed';

  const { record, legacySummary } = await upsertAiModerationRecord({
    post,
    textResult: moderationPlan.textResult,
    imageResult: moderationPlan.imageResult,
    videoResult: moderationPlan.videoResult,
    aggregate: moderationPlan.aggregate,
    lifecycleStatus,
    queueUpdate,
    metadata: {
      source: 'post_create',
      requestId: reqContext.requestId || '',
      clientRequestId: reqContext.clientRequestId || '',
    },
  });

  recordActionMetrics(moderationPlan.aggregate.finalAction);

  if (moderationPlan.aggregate.finalAction === MODERATION_ACTIONS.REVIEW) {
    await syncPostApprovalArtifacts(post, legacySummary, reqContext);
  } else if (moderationPlan.aggregate.finalAction === MODERATION_ACTIONS.REJECT) {
    await notifyCreatorAutoRejected(post, legacySummary);
  }

  return {
    record,
    legacySummary,
  };
}

async function finalizePendingScanPost({
  postId,
  imageResult = null,
  videoResult = null,
  source = 'moderation_worker',
}) {
  const post = await Post.findById(postId);
  if (!post) {
    return { success: false, reason: 'post_not_found' };
  }

  const record = await AiModeration.findOne({ postId });
  const textResult = record?.sourceResults?.text || null;

  const aggregate = await aggregateModerationResults({
    textResult,
    imageResult: imageResult || record?.sourceResults?.image || null,
    videoResult: videoResult || record?.sourceResults?.video || null,
    pendingSources: [],
  });

  const { record: updatedRecord, legacySummary } = await upsertAiModerationRecord({
    post,
    textResult,
    imageResult: imageResult || record?.sourceResults?.image || null,
    videoResult: videoResult || record?.sourceResults?.video || null,
    aggregate,
    lifecycleStatus: 'completed',
    queueUpdate: {
      image: imageResult
        ? {
            ...(record?.queue?.image?.toObject?.() || record?.queue?.image || {}),
            state: 'completed',
            completedAt: new Date(),
            waitMs: record?.metrics?.queueWaitMs || 0,
            processingMs: imageResult.durationMs || 0,
          }
        : undefined,
      video: videoResult
        ? {
            ...(record?.queue?.video?.toObject?.() || record?.queue?.video || {}),
            state: 'completed',
            completedAt: new Date(),
            processingMs: videoResult.durationMs || 0,
          }
        : undefined,
    },
    metadata: {
      source,
      finalizedBy: source,
    },
  });

  if (post.status === POST_STATUSES.PENDING_SCAN) {
    if (aggregate.finalAction === MODERATION_ACTIONS.APPROVE) {
      await rewardAndPublishApprovedPost(post, source, `scan_complete:${post._id}`);
    } else if (aggregate.finalAction === MODERATION_ACTIONS.REVIEW) {
      await syncPostApprovalArtifacts(post, legacySummary, {
        ipAddress: null,
      });
    } else if (aggregate.finalAction === MODERATION_ACTIONS.REJECT) {
      await notifyCreatorAutoRejected(post, legacySummary);
    }
  } else if (post.status === POST_STATUSES.PENDING_REVIEW && aggregate.finalAction === MODERATION_ACTIONS.REVIEW) {
    await syncPostApprovalArtifacts(post, legacySummary, {
      ipAddress: null,
    });
  }

  recordActionMetrics(aggregate.finalAction);

  return {
    success: true,
    post,
    record: updatedRecord,
    legacySummary,
    aggregate,
  };
}

async function processImageModerationJob(job) {
  const startedAt = Date.now();
  const payload = job?.data || {};
  const postId = payload.postId;
  const record = await AiModeration.findOne({ postId });

  if (record) {
    record.lifecycleStatus = 'processing';
    if (record.queue?.image) {
      record.queue.image.state = 'processing';
      record.queue.image.startedAt = new Date();
      record.queue.image.attemptsMade = Number(job?.attemptsMade || 0);
    }
    await record.save();
  }

  const imageResult = await moderateImageBatch({
    imageUrls: payload.imageUrls || [],
    filePaths: payload.imageFilePaths || [],
    includeDebug: false,
  });

  const result = await finalizePendingScanPost({
    postId,
    imageResult,
    source: 'image_moderation_worker',
  });

  return {
    success: result.success,
    postId,
    finalAction: result.aggregate?.finalAction || null,
    metrics: {
      processDurationMs: Date.now() - startedAt,
    },
  };
}

async function processVideoModerationJob(job) {
  const payload = job?.data || {};
  const postId = payload.postId;
  const record = await AiModeration.findOne({ postId });

  if (record) {
    record.lifecycleStatus = 'processing';
    if (record.queue?.video) {
      record.queue.video.state = 'processing';
      record.queue.video.startedAt = new Date();
      record.queue.video.attemptsMade = Number(job?.attemptsMade || 0);
      record.queue.video.lastError = 'Video moderation model is not implemented in Phase 1.';
    }
    await record.save();
  }

  const videoResult = await moderateVideoPlaceholder({
    videoUrl: payload.videoUrl || '',
    audioUrl: payload.audioUrl || '',
  });

  const post = await Post.findById(postId);
  if (!post) {
    return {
      success: false,
      reason: 'post_not_found',
    };
  }

  const aggregate = {
    finalAction: MODERATION_ACTIONS.PENDING_SCAN,
    finalStatus: POST_STATUSES.PENDING_SCAN,
    approved: false,
    requiresHumanReview: false,
    requiresAsyncScan: true,
    reasons: videoResult.reasons || [],
    confidence: 0,
    scores: record?.sourceResults?.aggregate?.scores || {},
    evidence: videoResult.evidence || [],
    flagged: false,
    flaggedCategories: [],
    moderationSources: uniqueList([
      ...(record?.moderationSources || []),
      videoResult.source,
    ]),
    pendingSources: [videoResult.source],
    durationMs: 0,
  };

  await upsertAiModerationRecord({
    post,
    textResult: record?.sourceResults?.text || null,
    imageResult: record?.sourceResults?.image || null,
    videoResult,
    aggregate,
    lifecycleStatus: 'queued',
    queueUpdate: {
      video: {
        ...(record?.queue?.video?.toObject?.() || record?.queue?.video || {}),
        state: 'processing',
        lastError: 'Video moderation placeholder stored. Replace with a real multimodal pipeline in Phase 2.',
      },
    },
    metadata: {
      source: 'video_placeholder_worker',
    },
  });

  return {
    success: true,
    postId,
    finalAction: MODERATION_ACTIONS.PENDING_SCAN,
  };
}

async function applyModeratorDecision({
  moderationId,
  moderatorId,
  decision,
  reason = '',
  source = 'moderation_api',
}) {
  const record = await AiModeration.findById(moderationId);
  if (!record) {
    throw new Error('Moderation record not found');
  }

  const post = await Post.findById(record.postId);
  if (!post) {
    throw new Error('Post not found');
  }

  const normalizedDecision = String(decision || '').trim().toLowerCase();
  if (!['approve', 'reject'].includes(normalizedDecision)) {
    throw new Error('Unsupported moderator decision');
  }

  const nextStatus = normalizedDecision === 'approve'
    ? POST_STATUSES.APPROVED
    : POST_STATUSES.REJECTED;

  post.status = nextStatus;
  post.aiModeration = {
    ...(post.aiModeration || {}),
    moderatorDecision: normalizedDecision,
    moderatorReason: reason,
    finalAction: normalizedDecision,
    finalStatus: nextStatus,
    approved: normalizedDecision === 'approve',
    requiresHumanReview: false,
  };
  await post.save();

  record.lifecycleStatus = 'reviewed';
  record.finalAction = normalizedDecision;
  record.reviewedBy = moderatorId;
  record.reviewedAt = new Date();
  record.moderatorDecision = normalizedDecision;
  record.moderatorReason = String(reason || '').trim();
  record.metrics.accuracyOutcome =
    normalizedDecision === record.sourceResults?.aggregate?.finalAction
      ? 'ai_confirmed'
      : 'human_overrode_ai';
  await record.save();

  const approvalEntry = await PostApproval.findOne({ post: post._id });
  if (approvalEntry) {
    approvalEntry.status = normalizedDecision === 'approve' ? 'approved' : 'rejected';
    approvalEntry.aiModeration = post.aiModeration;
    await approvalEntry.save();
  }

  await ModerationItem.updateMany(
    {
      targetPostId: post._id,
      type: 'system_flag',
      status: 'pending',
    },
    {
      $set: {
        status: normalizedDecision === 'approve' ? 'approved' : 'rejected',
        handledBy: moderatorId,
        handledAt: new Date(),
      },
    },
  );

  if (normalizedDecision === 'approve') {
    await rewardAndPublishApprovedPost(post, source, `moderator_approved:${post._id}`);
  } else {
    await notifyCreatorAutoRejected(post, {
      reason: reason || 'Your post was rejected by a moderator.',
    });
  }

  return {
    record,
    post,
  };
}

module.exports = {
  applyModeratorDecision,
  buildLegacyModerationSummary,
  finalizePendingScanPost,
  initializePostModeration,
  preparePostModeration,
  processImageModerationJob,
  processVideoModerationJob,
  syncPostApprovalArtifacts,
  upsertAiModerationRecord,
};
