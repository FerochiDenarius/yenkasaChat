const User = require('../../../models/user.model');
const DeadLetterEvent = require('../models/deadLetterEvent.model');
const UserEvent = require('../models/userEvent.model');
const MemoryEmbedding = require('../models/memoryEmbedding.model');
const MemoryLog = require('../models/memoryLog.model');
const { getRequiredVectorIndexes } = require('../services/vectorSearch.service');
const { getYmeConfig } = require('../config/yme.config');
const { getUnifiedMemoryProfile } = require('../services/memoryProfile.service');
const { getDeadLetterStats } = require('../services/deadLetterQueue.service');
const { getMetricsSnapshot } = require('../services/metrics.service');
const { buildInspectorOverview } = require('../services/inspector.service');
const { getQueueHealth, getQueueState } = require('../services/queue.service');
const { ingestEvent, ingestEventBatch } = require('../services/eventIngestion.service');
const { retrieveUserMemoryContext } = require('../services/retrieval.service');
const { runMemoryConsolidation } = require('../services/consolidation.service');

function getAuthenticatedUserId(req) {
  return String(req.user?._id || req.user?.id || '');
}

function canAccessUser(req, userId) {
  const authenticatedUserId = getAuthenticatedUserId(req);
  return authenticatedUserId === String(userId) || req.user?.permissions?.analyticsAccess === true;
}

function buildIngestDefaults(req) {
  return {
    userId: getAuthenticatedUserId(req),
    traceId:
      String(
        req.header?.('X-Trace-Id') ||
          req.header?.('X-Request-Id') ||
          req.header?.('X-Correlation-Id') ||
          '',
      )
        .trim()
        .slice(0, 160),
    requestId:
      String(req.header?.('X-Request-Id') || req.header?.('X-Correlation-Id') || '')
        .trim()
        .slice(0, 160),
  };
}

async function postEvent(req, res) {
  try {
    const requestedUserId = String(req.body?.userId || '');
    if (requestedUserId && !canAccessUser(req, requestedUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Events can only be written for the authenticated user.',
      });
    }

    const result = await ingestEvent(req.body, {
      defaults: buildIngestDefaults(req),
      req,
    });

    return res.status(202).json({
      success: true,
      event: result.event,
      skipped: result.skipped === true,
      dispatch: result.dispatch,
    });
  } catch (error) {
    console.error('[YME] Event ingest request failed:', {
      message: error.message,
      stack: error.stack,
      userId: getAuthenticatedUserId(req),
      payload: req.body || {},
    });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to ingest event.',
    });
  }
}

async function postEventBatch(req, res) {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const invalidUserId = events.find((event) => event?.userId && !canAccessUser(req, event.userId));
    if (invalidUserId) {
      return res.status(403).json({
        success: false,
        message: 'Batch contains events for a different user.',
      });
    }

    const result = await ingestEventBatch(events, {
      defaults: buildIngestDefaults(req),
      req,
    });

    return res.status(202).json({
      success: true,
      partialFailure: result.failedCount > 0,
      acceptedCount: result.count,
      ...result,
    });
  } catch (error) {
    console.error('[YME] Event batch request failed:', {
      message: error.message,
      stack: error.stack,
      userId: getAuthenticatedUserId(req),
      eventCount: Array.isArray(req.body?.events) ? req.body.events.length : 0,
      payload: req.body || {},
    });
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to ingest event batch.',
    });
  }
}

async function getProfile(req, res) {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Memory profile access denied.',
      });
    }

    const profile = await getUnifiedMemoryProfile(req.params.userId);
    return res.json({
      success: true,
      profile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch memory profile.',
    });
  }
}

async function retrieveContext(req, res) {
  try {
    const requestedUserId = String(req.body?.userId || req.query?.userId || '');
    const userId = requestedUserId || getAuthenticatedUserId(req);
    if (!canAccessUser(req, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Memory retrieval access denied.',
      });
    }

    const result = await retrieveUserMemoryContext({
      userId,
      query: req.body?.query || req.query?.query || '',
      conversationId: req.body?.conversationId || req.query?.conversationId || '',
      limit: Number(req.body?.limit || req.query?.limit || getYmeConfig().api.retrievalLimit),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve memory context.',
    });
  }
}

async function triggerConsolidation(req, res) {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Memory consolidation access denied.',
      });
    }

    const result = await runMemoryConsolidation({
      userId: req.params.userId,
      reason: req.body?.reason || 'manual_api',
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to run consolidation.',
    });
  }
}

async function getRecentEvents(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.sourceApp) filter.sourceApp = String(req.query.sourceApp).trim();
    if (req.query.eventType) filter.eventType = String(req.query.eventType).trim();
    if (req.query.processingStatus) filter.processingStatus = String(req.query.processingStatus).trim();
    if (req.query.shouldEmbed !== undefined) {
      filter.shouldEmbed = ['1', 'true', 'yes'].includes(String(req.query.shouldEmbed).toLowerCase());
    }
    if (req.query.minImportance) {
      filter.importanceScore = { $gte: Number(req.query.minImportance || 0) };
    }

    const [items, total] = await Promise.all([
      UserEvent.find(filter)
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserEvent.countDocuments(filter),
    ]);

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch YME events.',
    });
  }
}

async function searchUsers(req, res) {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));

    if (!q) {
      return res.json({
        success: true,
        items: [],
        pagination: {
          total: 0,
          limit,
        },
      });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const filter = {
      $or: [
        { username: regex },
        { email: regex },
        { phoneNumber: regex },
        { walletId: regex },
      ],
    };

    if (/^[a-f\d]{24}$/i.test(q)) {
      filter.$or.unshift({ _id: q });
    }

    const items = await User.find(filter)
      .select('username email phoneNumber walletId profileImage verified accessRole roleName staffRole online lastSeen lastLoginAt')
      .sort({ lastSeen: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      items: items.map((user) => ({
        id: String(user._id || ''),
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        walletId: user.walletId || '',
        profileImage: user.profileImage || '',
        verified: Boolean(user.verified),
        accessRole: user.accessRole || '',
        roleName: user.roleName || '',
        staffRole: user.staffRole || '',
        online: Boolean(user.online),
        lastSeen: user.lastSeen || null,
        lastLoginAt: user.lastLoginAt || null,
      })),
      pagination: {
        total: items.length,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search users.',
    });
  }
}

async function getLogs(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.stage) filter.stage = String(req.query.stage).trim();
    if (req.query.level) filter.level = String(req.query.level).trim();

    const [items, total] = await Promise.all([
      MemoryLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      MemoryLog.countDocuments(filter),
    ]);

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch YME logs.',
    });
  }
}

async function getHealth(_req, res) {
  const deadLetter = await getDeadLetterStats(24).catch(() => ({
    windowHours: 24,
    openCount: 0,
    recentCount: 0,
    byEventType: [],
  }));
  return res.json({
    success: true,
    status: 'ok',
    config: {
      sourceApps: getYmeConfig().sourceApps,
      queue: getQueueState(),
      vectorIndexes: getRequiredVectorIndexes(),
      deadLetter,
    },
  });
}

async function getMetrics(_req, res) {
  const deadLetter = await getDeadLetterStats(24).catch(() => ({
    windowHours: 24,
    openCount: 0,
    recentCount: 0,
    byEventType: [],
  }));
  return res.json({
    success: true,
    metrics: getMetricsSnapshot(),
    queue: getQueueState(),
    deadLetter,
  });
}

async function getEventStats(req, res) {
  try {
    const windowHours = Math.min(168, Math.max(1, Number(req.query.windowHours || 24)));
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [eventCounts, failedCount, queuedCount, processingStatusCounts, deadLetter] = await Promise.all([
      UserEvent.aggregate([
        {
          $match: {
            occurredAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      UserEvent.countDocuments({
        occurredAt: { $gte: since },
        $or: [
          { processingStatus: 'failed' },
          { processingError: { $exists: true, $ne: '' } },
        ],
      }),
      UserEvent.countDocuments({
        occurredAt: { $gte: since },
        processingStatus: 'queued',
      }),
      UserEvent.aggregate([
        {
          $match: {
            occurredAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: '$processingStatus',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      getDeadLetterStats(windowHours),
    ]);

    return res.json({
      success: true,
      windowHours,
      failedCount,
      queuedCount,
      deadLetter,
      byEventType: eventCounts.map((item) => ({
        eventType: item._id || 'unknown',
        count: item.count,
      })),
      byProcessingStatus: processingStatusCounts.map((item) => ({
        processingStatus: item._id || 'unknown',
        count: item.count,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch YME event stats.',
    });
  }
}

async function getDeadLetters(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.status) filter.status = String(req.query.status).trim();
    if (req.query.eventType) filter.eventType = String(req.query.eventType).trim();
    if (req.query.traceId) filter.traceId = String(req.query.traceId).trim();
    if (req.query.userId) filter.userId = req.query.userId;

    const [items, total, summary] = await Promise.all([
      DeadLetterEvent.find(filter).sort({ lastFailedAt: -1 }).skip(skip).limit(limit).lean(),
      DeadLetterEvent.countDocuments(filter),
      getDeadLetterStats(Number(req.query.windowHours || 24)),
    ]);

    return res.json({
      success: true,
      summary,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dead-letter events.',
    });
  }
}

function getIndexes(_req, res) {
  return res.json({
    success: true,
    indexes: getRequiredVectorIndexes(),
  });
}

async function getQueueHealthSnapshot(_req, res) {
  try {
    const queue = await getQueueHealth();
    return res.json({
      success: true,
      queue,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch queue health.',
    });
  }
}

async function getEmbeddings(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.sourceType) filter.sourceType = String(req.query.sourceType).trim();
    if (req.query.memoryTier) filter.memoryTier = String(req.query.memoryTier).trim();
    if (req.query.status) filter.status = String(req.query.status).trim();

    const [items, total] = await Promise.all([
      MemoryEmbedding.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MemoryEmbedding.countDocuments(filter),
    ]);

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch memory embeddings.',
    });
  }
}

async function getFailedEmbeddings(req, res) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const items = await MemoryEmbedding.find({ status: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch failed embeddings.',
    });
  }
}

async function inspectRetrieval(req, res) {
  try {
    const userId = String(req.body?.userId || req.query?.userId || '');
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required for retrieval inspection.',
      });
    }
    if (!canAccessUser(req, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Memory retrieval access denied.',
      });
    }

    const result = await retrieveUserMemoryContext({
      userId,
      query: req.body?.query || req.query?.query || '',
      conversationId: req.body?.conversationId || req.query?.conversationId || '',
      limit: Number(req.body?.limit || req.query?.limit || getYmeConfig().api.retrievalLimit),
    });

    return res.json({
      success: true,
      inspection: {
        userId,
        query: req.body?.query || req.query?.query || '',
        matchCount: Array.isArray(result.matches) ? result.matches.length : 0,
      },
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to inspect retrieval.',
    });
  }
}

async function getInspectorOverview(req, res) {
  try {
    const overview = await buildInspectorOverview({
      userId: req.query?.userId || req.body?.userId || '',
      query: req.query?.query || req.body?.query || '',
      limit: Number(req.query?.limit || req.body?.limit || 30),
    });

    return res.json({
      success: true,
      ...overview,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to fetch inspector overview.',
    });
  }
}

module.exports = {
  postEvent,
  postEventBatch,
  getProfile,
  retrieveContext,
  triggerConsolidation,
  getRecentEvents,
  searchUsers,
  getLogs,
  getHealth,
  getMetrics,
  getEventStats,
  getDeadLetters,
  getIndexes,
  getQueueHealthSnapshot,
  getEmbeddings,
  getFailedEmbeddings,
  inspectRetrieval,
  getInspectorOverview,
};
