const MemoryEmbedding = require('../models/memoryEmbedding.model');
const MemoryLog = require('../models/memoryLog.model');
const UserEvent = require('../models/userEvent.model');
const { ObservabilityEvent } = require('../models/observabilityEvent.model');
const { getMetricsSnapshot } = require('../services/metrics.service');
const { getQueueHealth } = require('../services/queue.service');
const { getIntelligenceBridgeHealth } = require('../services/intelligenceBridge.service');

function buildSince(windowMinutes = 60) {
  const minutes = Math.max(1, Number(windowMinutes || 60));
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function listLiveErrors({ limit = 25, windowMinutes = 180 } = {}) {
  return ObservabilityEvent.find({
    severity: { $in: ['error', 'critical'] },
    occurredAt: { $gte: buildSince(windowMinutes) },
  })
    .sort({ occurredAt: -1, importanceScore: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit || 25))))
    .lean();
}

async function getTopActiveUsers({ limit = 10, windowHours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(windowHours || 24)) * 60 * 60 * 1000);
  return ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        userId: { $nin: ['', null] },
        category: { $in: ['user_activity', 'engagement'] },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalEvents: { $sum: 1 },
        lastSeenAt: { $max: '$occurredAt' },
        averageImportance: { $avg: '$importanceScore' },
      },
    },
    { $sort: { totalEvents: -1, averageImportance: -1 } },
    { $limit: Math.min(50, Math.max(1, Number(limit || 10))) },
  ]);
}

async function getTrendingCommunities({ limit = 10, windowHours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(windowHours || 24)) * 60 * 60 * 1000);
  return UserEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        communityId: { $ne: null },
        eventType: { $in: ['caption', 'comment', 'share', 'follow', 'watch', 'community_join'] },
      },
    },
    {
      $group: {
        _id: { $toString: '$communityId' },
        totalEvents: { $sum: 1 },
        highImportanceEvents: {
          $sum: {
            $cond: [{ $gte: ['$importanceScore', 0.6] }, 1, 0],
          },
        },
        watchTimeMs: { $sum: '$eventMetadata.watchTimeMs' },
      },
    },
    {
      $addFields: {
        trendScore: {
          $add: [
            '$totalEvents',
            { $multiply: ['$highImportanceEvents', 2] },
            { $divide: ['$watchTimeMs', 30000] },
          ],
        },
      },
    },
    { $sort: { trendScore: -1, totalEvents: -1 } },
    { $limit: Math.min(50, Math.max(1, Number(limit || 10))) },
  ]);
}

async function getEngagementHeatmap({ windowHours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(windowHours || 24)) * 60 * 60 * 1000);
  return ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        category: { $in: ['user_activity', 'engagement'] },
      },
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$occurredAt' },
          category: '$category',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.hour': 1, count: -1 } },
  ]);
}

async function getCreatorAnalytics({ limit = 10, windowHours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(windowHours || 24)) * 60 * 60 * 1000);
  return UserEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        creatorId: { $ne: null },
        eventType: { $in: ['watch', 'like', 'comment', 'share', 'follow', 'save_post'] },
      },
    },
    {
      $group: {
        _id: { $toString: '$creatorId' },
        totalEvents: { $sum: 1 },
        watchTimeMs: { $sum: '$eventMetadata.watchTimeMs' },
        averageImportance: { $avg: '$importanceScore' },
      },
    },
    {
      $addFields: {
        creatorScore: {
          $add: [
            '$totalEvents',
            { $divide: ['$watchTimeMs', 20000] },
            { $multiply: ['$averageImportance', 10] },
          ],
        },
      },
    },
    { $sort: { creatorScore: -1, totalEvents: -1 } },
    { $limit: Math.min(50, Math.max(1, Number(limit || 10))) },
  ]);
}

async function getModerationAnalytics({ windowHours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(windowHours || 24)) * 60 * 60 * 1000);
  const [summary] = await ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        category: 'moderation_event',
      },
    },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        reports: {
          $sum: {
            $cond: [{ $eq: ['$eventName', 'user_report_created'] }, 1, 0],
          },
        },
        approvals: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventName', regex: /approve/i } }, 1, 0],
          },
        },
        rejections: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventName', regex: /reject/i } }, 1, 0],
          },
        },
      },
    },
  ]);

  return summary || {
    totalEvents: 0,
    reports: 0,
    approvals: 0,
    rejections: 0,
  };
}

async function getInfrastructureHealth({ windowMinutes = 60 } = {}) {
  const since = buildSince(windowMinutes);
  const [summary] = await ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        category: { $in: ['api_failure', 'system_error', 'upload_failure', 'infrastructure_event'] },
      },
    },
    {
      $group: {
        _id: null,
        totalFailures: { $sum: 1 },
        criticalFailures: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0],
          },
        },
        avgLatencyMs: { $avg: '$latencyMs' },
        maxLatencyMs: { $max: '$latencyMs' },
      },
    },
  ]);

  const slowRoutes = await ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        latencyMs: { $gte: 1000 },
        routePath: { $nin: ['', null] },
      },
    },
    {
      $group: {
        _id: '$routePath',
        count: { $sum: 1 },
        avgLatencyMs: { $avg: '$latencyMs' },
        maxLatencyMs: { $max: '$latencyMs' },
      },
    },
    { $sort: { count: -1, avgLatencyMs: -1 } },
    { $limit: 10 },
  ]);

  return {
    summary:
      summary || {
        totalFailures: 0,
        criticalFailures: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0,
      },
    slowRoutes,
  };
}

async function getAiMemoryStats({ windowHours = 24 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(windowHours || 24)) * 60 * 60 * 1000);
  const [events, failedEvents, embeddings, failedEmbeddings, errorLogs] = await Promise.all([
    UserEvent.countDocuments({ occurredAt: { $gte: since } }),
    UserEvent.countDocuments({ occurredAt: { $gte: since }, processingStatus: 'failed' }),
    MemoryEmbedding.countDocuments({ updatedAt: { $gte: since } }),
    MemoryEmbedding.countDocuments({ updatedAt: { $gte: since }, status: 'failed' }),
    MemoryLog.countDocuments({ createdAt: { $gte: since }, level: 'error' }),
  ]);

  return {
    events,
    failedEvents,
    embeddings,
    failedEmbeddings,
    errorLogs,
  };
}

async function getCrashDetections({ windowMinutes = 60 } = {}) {
  const since = buildSince(windowMinutes);
  return ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        severity: { $in: ['error', 'critical'] },
        $or: [
          { category: 'system_error' },
          { eventName: { $regex: /(crash|failed|timeout|disconnect)/i } },
        ],
      },
    },
    {
      $group: {
        _id: {
          eventName: '$eventName',
          sourceModule: '$sourceModule',
          stack: '$metadata.error.stack',
        },
        count: { $sum: 1 },
        latestAt: { $max: '$occurredAt' },
      },
    },
    { $sort: { count: -1, latestAt: -1 } },
    { $limit: 10 },
  ]);
}

async function getApiFailureSpikes({ windowMinutes = 60 } = {}) {
  const since = buildSince(windowMinutes);
  return ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        category: 'api_failure',
      },
    },
    {
      $group: {
        _id: '$routePath',
        count: { $sum: 1 },
        latestAt: { $max: '$occurredAt' },
        statusCodes: { $addToSet: '$statusCode' },
        avgLatencyMs: { $avg: '$latencyMs' },
      },
    },
    { $sort: { count: -1, latestAt: -1 } },
    { $limit: 10 },
  ]);
}

async function getSuspiciousActivitySignals({ windowMinutes = 60 } = {}) {
  const since = buildSince(windowMinutes);
  return ObservabilityEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        category: { $in: ['auth_event', 'engagement', 'payment_event', 'moderation_event'] },
        userId: { $nin: ['', null] },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalEvents: { $sum: 1 },
        uniqueEventNames: { $addToSet: '$eventName' },
        authFailures: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventName', regex: /auth_.*failure|invalid|expired/i } }, 1, 0],
          },
        },
        rewardEvents: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventName', regex: /reward|monetization/i } }, 1, 0],
          },
        },
        lastSeenAt: { $max: '$occurredAt' },
      },
    },
    {
      $addFields: {
        suspicionScore: {
          $add: [
            '$authFailures',
            { $multiply: ['$rewardEvents', 1.5] },
            { $divide: ['$totalEvents', 25] },
            { $divide: [{ $size: '$uniqueEventNames' }, 10] },
          ],
        },
      },
    },
    { $sort: { suspicionScore: -1, lastSeenAt: -1 } },
    { $limit: 10 },
  ]);
}

async function getObservabilityOverview({ windowMinutes = 60 } = {}) {
  const since = buildSince(windowMinutes);
  const [
    liveErrors,
    authAnomalies,
    uploadFailures,
    errorSpikes,
    aiMemoryStats,
    infrastructureHealth,
    bridgeHealth,
    repeatedCrashes,
    apiFailureSpikes,
    suspiciousActivity,
  ] =
    await Promise.all([
      listLiveErrors({ limit: 12, windowMinutes }),
      ObservabilityEvent.aggregate([
        {
          $match: {
            occurredAt: { $gte: since },
            category: 'auth_event',
            statusCode: { $in: [401, 403, 404, 409] },
          },
        },
        {
          $group: {
            _id: { userId: '$userId', ip: '$metadata.ip' },
            count: { $sum: 1 },
            latestAt: { $max: '$occurredAt' },
          },
        },
        { $sort: { count: -1, latestAt: -1 } },
        { $limit: 10 },
      ]),
      ObservabilityEvent.aggregate([
        {
          $match: {
            occurredAt: { $gte: since },
            category: 'upload_failure',
          },
        },
        {
          $group: {
            _id: '$routePath',
            count: { $sum: 1 },
            latestAt: { $max: '$occurredAt' },
          },
        },
        { $sort: { count: -1, latestAt: -1 } },
        { $limit: 10 },
      ]),
      ObservabilityEvent.aggregate([
        {
          $match: {
            occurredAt: { $gte: since },
            severity: { $in: ['error', 'critical'] },
          },
        },
        {
          $group: {
            _id: { eventName: '$eventName', sourceModule: '$sourceModule' },
            count: { $sum: 1 },
            latestAt: { $max: '$occurredAt' },
          },
        },
        { $sort: { count: -1, latestAt: -1 } },
        { $limit: 10 },
      ]),
      getAiMemoryStats({ windowHours: Math.ceil(windowMinutes / 60) }),
      getInfrastructureHealth({ windowMinutes }),
      getIntelligenceBridgeHealth(),
      getCrashDetections({ windowMinutes }),
      getApiFailureSpikes({ windowMinutes }),
      getSuspiciousActivitySignals({ windowMinutes }),
    ]);

  return {
    windowMinutes: Math.max(1, Number(windowMinutes || 60)),
    liveErrors,
    errorSpikes,
    repeatedCrashes,
    apiFailureSpikes,
    uploadFailures,
    authAnomalies,
    suspiciousActivity,
    aiHealth: {
      memory: aiMemoryStats,
      metrics: getMetricsSnapshot(),
      bridge: bridgeHealth,
    },
    infrastructure: infrastructureHealth,
  };
}

async function getDashboardFoundation({ windowHours = 24 } = {}) {
  const [
    liveErrors,
    topActiveUsers,
    trendingCommunities,
    engagementHeatmap,
    aiMemoryStats,
    queue,
    moderationAnalytics,
    creatorAnalytics,
    infrastructureHealth,
    bridgeHealth,
    suspiciousActivity,
  ] =
    await Promise.all([
      listLiveErrors({ limit: 20, windowMinutes: windowHours * 60 }),
      getTopActiveUsers({ limit: 10, windowHours }),
      getTrendingCommunities({ limit: 10, windowHours }),
      getEngagementHeatmap({ windowHours }),
      getAiMemoryStats({ windowHours }),
      getQueueHealth().catch((error) => ({ success: false, message: error.message })),
      getModerationAnalytics({ windowHours }),
      getCreatorAnalytics({ limit: 10, windowHours }),
      getInfrastructureHealth({ windowMinutes: windowHours * 60 }),
      getIntelligenceBridgeHealth(),
      getSuspiciousActivitySignals({ windowMinutes: windowHours * 60 }),
    ]);

  return {
    windowHours: Math.max(1, Number(windowHours || 24)),
    liveErrors,
    topActiveUsers,
    trendingCommunities,
    engagementHeatmap,
    aiMemoryStats,
    queueHealth: queue,
    bridgeHealth,
    moderationAnalytics,
    creatorAnalytics,
    infrastructureHealth,
    suspiciousActivity,
  };
}

module.exports = {
  listLiveErrors,
  getTopActiveUsers,
  getTrendingCommunities,
  getEngagementHeatmap,
  getCreatorAnalytics,
  getModerationAnalytics,
  getInfrastructureHealth,
  getAiMemoryStats,
  getObservabilityOverview,
  getDashboardFoundation,
};
