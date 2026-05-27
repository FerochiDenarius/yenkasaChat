const express = require('express');

const authMiddleware = require('../middleware/auth');
const AiModeration = require('../models/aiModeration.model');
const Post = require('../models/post.model');
const { canApproveContent } = require('../middleware/permissions');
const { publishYmeEvent } = require('../src/yme/services/eventPublisher.service');
const {
  applyModeratorDecision,
} = require('../src/ai/services/moderationWorkflow.service');
const {
  getModerationMetrics,
} = require('../src/ai/services/moderationMetrics.service');
const {
  getModerationQueueState,
} = require('../src/ai/services/moderationQueue.service');

const router = express.Router();

function logModerationAudit({ moderatorId, action, targetId, status }) {
  console.info('[ModerationAudit]', {
    moderatorId: moderatorId ? moderatorId.toString() : null,
    action,
    targetId: targetId ? targetId.toString() : null,
    status,
    timestamp: new Date().toISOString(),
  });
}

function requireModerator(req, res, next) {
  if (!canApproveContent(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Moderation access denied',
    });
  }

  next();
}

router.get('/', authMiddleware, requireModerator, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.finalAction) filter.finalAction = String(req.query.finalAction).trim();
    if (req.query.lifecycleStatus) filter.lifecycleStatus = String(req.query.lifecycleStatus).trim();
    if (req.query.flagged === 'true') filter.flaggedCategories = { $exists: true, $ne: [] };

    const [items, total] = await Promise.all([
      AiModeration.find(filter)
        .populate('postId', 'text imageUrl imageUrls videoUrl audioUrl status communityName postType createdAt userId')
        .populate('reviewedBy', 'username roleName accessRole')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AiModeration.countDocuments(filter),
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch AI moderation records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI moderation records',
    });
  }
});

router.get('/flagged', authMiddleware, requireModerator, async (req, res) => {
  try {
    const items = await AiModeration.find({
      finalAction: { $in: ['review', 'reject', 'pending_scan'] },
    })
      .populate('postId', 'text imageUrl imageUrls videoUrl audioUrl status communityName postType createdAt userId')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('Failed to fetch flagged AI moderation records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flagged moderation records',
    });
  }
});

router.get('/metrics/summary', authMiddleware, requireModerator, async (_req, res) => {
  res.json({
    success: true,
    metrics: getModerationMetrics(),
    queue: getModerationQueueState(),
  });
});

router.get('/:id', authMiddleware, requireModerator, async (req, res) => {
  try {
    const moderation = await AiModeration.findById(req.params.id)
      .populate('postId')
      .populate('reviewedBy', 'username roleName accessRole')
      .lean();

    if (!moderation) {
      return res.status(404).json({
        success: false,
        message: 'Moderation record not found',
      });
    }

    const post = moderation.postId?._id
      ? moderation.postId
      : await Post.findById(moderation.postId).lean();

    res.json({
      success: true,
      moderation,
      post,
      evidence: moderation.evidence || {},
    });
  } catch (error) {
    console.error('Failed to fetch AI moderation record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch moderation record',
    });
  }
});

router.post('/:id/decision', authMiddleware, requireModerator, async (req, res) => {
  try {
    const { decision, reason = '' } = req.body || {};
    const result = await applyModeratorDecision({
      moderationId: req.params.id,
      moderatorId: req.user.id,
      decision,
      reason,
      source: 'ai_moderation_api',
    });
    publishYmeEvent({
      userId: req.user.id,
      sourceApp: 'social_app',
      eventType: 'moderation_post_reviewed',
      postId: result.record?.postId?.toString?.() || result.post?._id?.toString?.() || '',
      relatedUserId: result.post?.userId?.toString?.() || '',
      payload: {
        moderationItemId: req.params.id,
        action: decision,
        reason,
        status: result.record?.lifecycleStatus || result.record?.finalAction || '',
      },
    });
    logModerationAudit({
      moderatorId: req.user.id,
      action: decision,
      targetId: result.record?.postId || result.post?._id || req.params.id,
      status: result.record?.lifecycleStatus || result.record?.finalAction || '',
    });

    res.json({
      success: true,
      moderation: result.record,
      post: result.post,
    });
  } catch (error) {
    console.error('Failed to apply moderator decision:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to apply moderator decision',
    });
  }
});

module.exports = router;
