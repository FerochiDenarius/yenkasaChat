const AIProfile = require('../models/aiProfile.model');
const EngagementPattern = require('../models/engagementPattern.model');
const SocialGraph = require('../models/socialGraph.model');
const UserMemory = require('../models/userMemory.model');
const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { emitMemoryProfileUpdated } = require('./realtime.service');
const { clamp } = require('../utils/yme.utils');

function logNormalizationError(error) {
  console.error('[YME_NORMALIZATION_ERROR]', {
    message: error.message,
    stack: error.stack,
  });
}

function isVersionConflict(error) {
  return error?.name === 'VersionError';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeScoredEntries(existing = [], incoming = [], { key = 'label', limit = 10 } = {}) {
  const merged = new Map();

  for (const item of existing) {
    const mapKey = String(item?.[key] || '');
    if (!mapKey) continue;
    merged.set(mapKey, {
      ...item,
      [key]: item[key],
      score: Number(item.score || 0),
      sourceCount: Number(item.sourceCount || 0),
      lastSeenAt: item.lastSeenAt ? new Date(item.lastSeenAt) : new Date(),
    });
  }

  for (const item of incoming) {
    const mapKey = String(item?.[key] || item?.creatorId || item?.hour || '');
    if (!mapKey) continue;
    const current = merged.get(mapKey) || {
      ...item,
      [key]: item[key],
      score: 0,
      sourceCount: 0,
      lastSeenAt: new Date(),
    };

    current.score = Number(current.score || 0) + Number(item.score || 0);
    current.sourceCount = Number(current.sourceCount || 0) + Number(item.sourceCount || 1);
    current.lastSeenAt = item.lastSeenAt ? new Date(item.lastSeenAt) : new Date();
    if (item.creatorId) current.creatorId = item.creatorId;
    if (item.hour !== undefined) current.hour = item.hour;
    merged.set(mapKey, current);
  }

  return [...merged.values()]
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .slice(0, limit);
}

async function ensureUserMemory(userId) {
  let profile = await UserMemory.findOne({ userId });
  if (!profile) {
    profile = await UserMemory.create({ userId });
  }
  return profile;
}

function buildRecentContextEntry(event) {
  return {
    type: event.eventType,
    text: normalizeText(event?.normalizedText || ''),
    sourceApp: event.sourceApp,
    conversationId: event.conversationId || '',
    occurredAt: new Date(event.occurredAt || Date.now()),
  };
}

function updateActiveHours(existing = [], hour) {
  const entries = [...existing];
  const current = entries.find((entry) => Number(entry.hour) === Number(hour));
  if (current) {
    current.score = Number(current.score || 0) + 1;
  } else {
    entries.push({ hour, score: 1 });
  }
  return entries.sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
}

function compactMemorySummaries(summaries = [], limit = 12) {
  const merged = new Map();

  for (const summary of summaries || []) {
    const key = normalizeText(summary?.summary || '');
    if (!key) continue;

    const current = merged.get(key) || {
      ...summary,
      summary: summary.summary,
      importance: Number(summary.importance || 0),
      createdAt: summary.createdAt ? new Date(summary.createdAt) : new Date(),
    };

    const currentImportance = Number(current.importance || 0);
    const nextImportance = Number(summary.importance || 0);
    if (nextImportance >= currentImportance) {
      current.source = summary.source || current.source;
      current.tier = summary.tier || current.tier;
      current.summary = summary.summary;
      current.importance = nextImportance;
      current.createdAt = summary.createdAt ? new Date(summary.createdAt) : current.createdAt;
    }
    current.lastSeenAt = summary.createdAt ? new Date(summary.createdAt) : new Date();
    merged.set(key, current);
  }

  return [...merged.values()]
    .sort((left, right) => Number(right.importance || 0) - Number(left.importance || 0))
    .slice(0, limit);
}

function pruneRecentContext(entries = [], limit = 20, maxAgeDays = 30) {
  const cutoffAt = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const deduped = new Map();

  for (let index = (entries || []).length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry) continue;

    const occurredAt = new Date(entry.occurredAt || Date.now()).getTime();
    if (!Number.isFinite(occurredAt) || occurredAt < cutoffAt) continue;

    const safeText = normalizeText(entry?.text || '');
    const key = `${entry.type || ''}:${safeText}`;
    if (!key || deduped.has(key)) continue;
    deduped.set(key, {
      ...entry,
      occurredAt: new Date(entry.occurredAt || Date.now()),
    });
  }

  return [...deduped.values()].reverse().slice(-limit);
}

function pruneMemoryProfile(profile) {
  const config = getYmeConfig();
  const recentContextLimit = Math.max(5, Number(config.consolidation.recentContextLimit || 20));
  const staleInterestDays = Math.max(7, Number(config.consolidation.staleInterestHalfLifeDays || 30));

  profile.shortTerm.recentContext = pruneRecentContext(
    profile.shortTerm.recentContext || [],
    recentContextLimit,
    staleInterestDays,
  );
  profile.memorySummaries = compactMemorySummaries(profile.memorySummaries || [], 12);
  profile.metadata = {
    ...(profile.metadata || {}),
    memoryMaintenance: {
      lastPrunedAt: new Date(),
      recentContextLimit,
      summaryLimit: 12,
      staleInterestDays,
    },
  };
}

async function updateEngagementPatterns(event) {
  const occurredAt = new Date(event.occurredAt || Date.now());
  const hour = String(occurredAt.getUTCHours());
  const weekday = String(occurredAt.getUTCDay());
  const watchTimeMs = Number(event?.eventMetadata?.watchTimeMs || 0);
  const scrollDurationMs = Number(event?.eventMetadata?.scrollDurationMs || 0);

  const current = (await EngagementPattern.findOne({ userId: event.userId })) || new EngagementPattern({
    userId: event.userId,
  });

  const hourlyHistogram = new Map((current.hourlyHistogram || []).map((item) => [item.key, Number(item.score || 0)]));
  hourlyHistogram.set(hour, (hourlyHistogram.get(hour) || 0) + 1);

  const weekdayHistogram = new Map((current.weekdayHistogram || []).map((item) => [item.key, Number(item.score || 0)]));
  weekdayHistogram.set(weekday, (weekdayHistogram.get(weekday) || 0) + 1);

  const eventTotals = { ...(current.eventTotals || {}) };
  eventTotals[event.eventType] = Number(eventTotals[event.eventType] || 0) + 1;
  const totalEvents = Object.values(eventTotals).reduce((sum, value) => sum + Number(value || 0), 0);

  current.hourlyHistogram = [...hourlyHistogram.entries()].map(([key, score]) => ({ key, score }));
  current.weekdayHistogram = [...weekdayHistogram.entries()].map(([key, score]) => ({ key, score }));
  current.eventTotals = eventTotals;
  current.lastActiveAt = occurredAt;
  current.engagementVelocity = clamp(totalEvents / 50, 0, 1);
  current.watchBehavior = {
    averageWatchTimeMs:
      totalEvents > 0
        ? Math.round(
            ((Number(current.watchBehavior?.averageWatchTimeMs || 0) * Math.max(totalEvents - 1, 0)) +
              watchTimeMs) /
              totalEvents,
          )
        : watchTimeMs,
    averageScrollDurationMs:
      totalEvents > 0
        ? Math.round(
            ((Number(current.watchBehavior?.averageScrollDurationMs || 0) * Math.max(totalEvents - 1, 0)) +
              scrollDurationMs) /
              totalEvents,
          )
        : scrollDurationMs,
    rewatchProbability: clamp(
      Number(current.watchBehavior?.rewatchProbability || 0) * 0.85 +
        clamp(watchTimeMs / 45000, 0, 1) * 0.15,
      0,
      1,
    ),
  };

  await current.save();
  return current;
}

async function updateSocialGraph(event) {
  if (!event.relatedUserId) return null;

  const update = {
    $inc: {
      weight: 1,
    },
    $set: {
      lastInteractionAt: new Date(event.occurredAt || Date.now()),
    },
    $addToSet: {
      relationshipTypes: event.eventType,
    },
  };

  if (event.communityId) {
    update.$addToSet.sharedCommunityIds = event.communityId;
  }

  return SocialGraph.findOneAndUpdate(
    {
      userId: event.userId,
      relatedUserId: event.relatedUserId,
    },
    update,
    {
      upsert: true,
      new: true,
    },
  );
}

async function updateAiProfile(userId, derivedSignals, event) {
  const profile = (await AIProfile.findOne({ userId })) || new AIProfile({ userId });
  profile.topicPreferences = mergeScoredEntries(
    (profile.topicPreferences || []).map((label) => ({ label, score: 1 })),
    derivedSignals.interests || [],
    { limit: 12 },
  ).map((entry) => entry.label);

  if (event.sourceApp === 'yenkasa_ai') {
    profile.responseStyles = [...new Set([...(profile.responseStyles || []), 'conversational'])];
  }
  if (!profile.preferredLanguages?.length) {
    profile.preferredLanguages = ['en'];
  }
  await profile.save();
  return profile;
}

async function applyEventToMemory({ event, derivedSignals }) {
  const config = getYmeConfig();
  const occurredAt = new Date(event.occurredAt || Date.now());
  const hour = occurredAt.getUTCHours();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const profile = await ensureUserMemory(event.userId);

      profile.shortTerm.activeSessionIds = [
        ...new Set([...(profile.shortTerm.activeSessionIds || []), event.sessionId].filter(Boolean)),
      ].slice(-10);
      profile.shortTerm.recentContext = [
        ...(profile.shortTerm.recentContext || []),
        buildRecentContextEntry(event),
      ].slice(-config.consolidation.recentContextLimit);
      profile.shortTerm.activeTopics = [
        ...new Set([
          ...(profile.shortTerm.activeTopics || []),
          ...(derivedSignals.interests || []).map((entry) => entry.label),
        ]),
      ].slice(-12);
      profile.shortTerm.activeInteractions = [
        ...new Set([
          ...(profile.shortTerm.activeInteractions || []),
          event.contentId,
          event.creatorId?.toString?.(),
          event.relatedUserId?.toString?.(),
        ].filter(Boolean)),
      ].slice(-20);
      profile.shortTerm.lastInteractionAt = occurredAt;

      profile.midTerm.recentTopics = mergeScoredEntries(
        profile.midTerm.recentTopics || [],
        derivedSignals.interests || [],
        { limit: config.consolidation.recentTopicLimit },
      );

      if (event.creatorId) {
        profile.midTerm.recentCreators = mergeScoredEntries(
          profile.midTerm.recentCreators || [],
          [
            {
              creatorId: event.creatorId,
              score: 1,
              lastEngagedAt: occurredAt,
            },
          ],
          { key: 'creatorId', limit: config.consolidation.creatorAffinityLimit },
        );
      }

      profile.longTerm.stableInterests = mergeScoredEntries(
        profile.longTerm.stableInterests || [],
        derivedSignals.interests || [],
        { limit: config.consolidation.stableInterestLimit },
      );
      profile.longTerm.activeHours = updateActiveHours(profile.longTerm.activeHours || [], hour);
      profile.longTerm.creatorAffinity = event.creatorId
        ? mergeScoredEntries(
            profile.longTerm.creatorAffinity || [],
            [
              {
                creatorId: event.creatorId,
                score: 1,
                lastEngagedAt: occurredAt,
              },
            ],
            { key: 'creatorId', limit: config.consolidation.creatorAffinityLimit },
          )
        : profile.longTerm.creatorAffinity || [];
      profile.longTerm.commerceSignals = mergeScoredEntries(
        profile.longTerm.commerceSignals || [],
        derivedSignals.commerceSignals || [],
        { limit: 12 },
      );
      profile.longTerm.emotionalPatterns = mergeScoredEntries(
        profile.longTerm.emotionalPatterns || [],
        derivedSignals.emotionalPatterns || [],
        { limit: 12 },
      );
      profile.longTerm.engagementPatterns = {
        ...(profile.longTerm.engagementPatterns || {}),
        lastEventType: event.eventType,
        lastSourceApp: event.sourceApp,
      };
      profile.lastEventAt = occurredAt;
      profile.lastProcessedEventId = event._id;

      pruneMemoryProfile(profile);
      const savedProfile = await UserMemory.findOneAndUpdate(
        { _id: profile._id },
        {
          $set: {
            shortTerm: profile.shortTerm,
            midTerm: profile.midTerm,
            longTerm: profile.longTerm,
            memorySummaries: profile.memorySummaries || [],
            lastEventAt: profile.lastEventAt,
            lastProcessedEventId: profile.lastProcessedEventId,
            metadata: profile.metadata || {},
          },
        },
        { new: true, runValidators: true },
      );

      const [engagementPattern, socialGraphEdge, aiProfile] = await Promise.all([
        updateEngagementPatterns(event),
        updateSocialGraph(event),
        updateAiProfile(event.userId, derivedSignals, event),
      ]);

      const latestProfile = savedProfile?.toObject?.() || await UserMemory.findById(profile._id).lean();
      const updatePayload = {
        'longTerm.aiProfile': {
          preferredTones: aiProfile.preferredTones || [],
          responseStyles: aiProfile.responseStyles || [],
          topicPreferences: aiProfile.topicPreferences || [],
        },
      };

      if (socialGraphEdge) {
        updatePayload['longTerm.socialGraph'] = {
          ...(latestProfile?.longTerm?.socialGraph || {}),
          lastRelatedUserId: socialGraphEdge.relatedUserId?.toString?.() || '',
          lastWeight: socialGraphEdge.weight,
        };
      }

      const updatedProfile = await UserMemory.findOneAndUpdate(
        { _id: profile._id },
        { $set: updatePayload },
        { new: true },
      );

      const finalProfile = updatedProfile || profile;

      emitMemoryProfileUpdated(event.userId, {
        userId: event.userId.toString(),
        lastEventType: event.eventType,
        lastInteractionAt: finalProfile.shortTerm?.lastInteractionAt || occurredAt,
      });

      return {
        profile: finalProfile,
        engagementPattern,
        aiProfile,
      };
    } catch (error) {
      if (isVersionConflict(error) && attempt < maxAttempts) {
        console.warn('[YME_MEMORY_RETRY]', {
          userId: event.userId?.toString?.() || '',
          eventId: event._id?.toString?.() || '',
          attempt,
          message: error.message,
        });
        await wait(attempt * 25);
        continue;
      }

      logNormalizationError(error);
      throw error;
    }
  }
}

async function refreshMemorySummary(userId, { reason = 'consolidation', behaviorSummary = '', chatSummary = '' } = {}) {
  try {
    const profile = await ensureUserMemory(userId);
    const stableInterests = (profile.longTerm.stableInterests || []).slice(0, 5).map((entry) => entry.label);
    const creatorAffinity = (profile.longTerm.creatorAffinity || [])
      .slice(0, 5)
      .map((entry) => entry.creatorId?.toString?.())
      .filter(Boolean);
    const safeBehaviorSummary = normalizeText(behaviorSummary || '');
    const safeChatSummary = normalizeText(chatSummary || '');

    const summaryLines = [
      stableInterests.length ? `stable interests: ${stableInterests.join(', ')}` : '',
      creatorAffinity.length ? `creator affinity: ${creatorAffinity.join(', ')}` : '',
      safeBehaviorSummary,
      safeChatSummary,
    ].filter(Boolean);

    const summary = normalizeText(summaryLines.join('. '));
    if (summary) {
      profile.memorySummaries = [
        {
          tier: 'long_term',
          source: reason,
          summary,
          importance: 0.85,
          createdAt: new Date(),
        },
        ...(profile.memorySummaries || []),
      ].slice(0, 12);
    }

    profile.midTerm.lastConsolidatedAt = new Date();
    pruneMemoryProfile(profile);
    const updatedProfile = await UserMemory.findOneAndUpdate(
      { _id: profile._id },
      {
        $set: {
          memorySummaries: profile.memorySummaries || [],
          midTerm: profile.midTerm,
          shortTerm: profile.shortTerm,
          longTerm: profile.longTerm,
          metadata: profile.metadata || {},
        },
      },
      { new: true, runValidators: true },
    );
    emitMemoryProfileUpdated(userId, {
      userId: userId.toString(),
      consolidatedAt: updatedProfile?.midTerm?.lastConsolidatedAt || profile.midTerm.lastConsolidatedAt,
      summary,
    });
    return summary;
  } catch (error) {
    logNormalizationError(error);
    throw error;
  }
}

async function getUnifiedMemoryProfile(userId) {
  return ensureUserMemory(userId);
}

module.exports = {
  ensureUserMemory,
  applyEventToMemory,
  refreshMemorySummary,
  getUnifiedMemoryProfile,
};
