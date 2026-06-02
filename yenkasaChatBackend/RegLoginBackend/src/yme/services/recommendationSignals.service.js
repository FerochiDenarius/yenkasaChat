const CreatorAffinity = require('../models/creatorAffinity.model');
const RecommendationSignal = require('../models/recommendationSignal.model');

const { clamp } = require('../utils/yme.utils');

function getBaseEventScore(eventType) {
  const scores = {
    like: 0.8,
    comment: 1.2,
    share: 1.5,
    follow: 2,
    watch: 1.1,
    scroll: 0.35,
    profile_visit: 0.7,
    search: 1.4,
    chat_message: 1.2,
    chat_response: 0.6,
    caption: 0.8,
    creator_interaction: 1.3,
    ad_engagement: 1.0,
    notification_open: 0.2,
    live_stream_join: 1.4,
    live_interaction: 1.6,
    stream_started: 1.2,
    stream_joined: 1.4,
    stream_comment: 1.6,
    stream_like: 1.1,
    stream_gift: 2.2,
    stream_share: 1.7,
    stream_follow_host: 2.0,
    stream_view_duration: 1.8,
    reward_claim: 1.1,
    community_join: 1.0,
    community_post_created: 1.25,
    notification_sent: 0.12,
    notification_opened: 0.45,
    notification_dismissed: 0.08,
  };

  return scores[eventType] || 0.5;
}

async function upsertRecommendationSignal({
  userId,
  entityType,
  entityId,
  category = '',
  affinityScore,
  engagementProbability,
  rewatchProbability,
  scoreBreakdown = {},
  metadata = {},
}) {
  return RecommendationSignal.findOneAndUpdate(
    {
      userId,
      entityType,
      entityId,
    },
    {
      $set: {
        category,
        affinityScore,
        engagementProbability,
        rewatchProbability,
        freshnessScore: clamp(affinityScore * 0.6 + 0.2, 0, 1),
        scoreBreakdown,
        lastSignalAt: new Date(),
        metadata,
      },
    },
    { upsert: true, new: true },
  );
}

async function applyRecommendationSignals({ event, derivedSignals }) {
  const baseScore = getBaseEventScore(event.eventType);
  const watchTimeMs = Number(event?.eventMetadata?.watchTimeMs || 0);
  const watchBoost = clamp(watchTimeMs / 45000, 0, 1);
  const engagementProbability = clamp(baseScore * 0.45 + watchBoost * 0.4, 0, 1);
  const rewatchProbability = clamp(watchBoost * 0.65 + (event.eventType === 'watch' ? 0.15 : 0), 0, 1);

  const updatedSignals = [];

  if (event.creatorId) {
    await CreatorAffinity.findOneAndUpdate(
      {
        userId: event.userId,
        creatorId: event.creatorId,
      },
      {
        $inc: {
          affinityScore: baseScore,
          watchTimeMs,
          [`eventCounts.${event.eventType}`]: 1,
          profileVisitCount: event.eventType === 'profile_visit' ? 1 : 0,
        },
        $set: {
          lastEngagedAt: new Date(event.occurredAt || Date.now()),
          sourceApp: event.sourceApp,
          contentCategories: derivedSignals.contentCategories || [],
        },
      },
      { upsert: true, new: true },
    );

    updatedSignals.push(
      await upsertRecommendationSignal({
        userId: event.userId,
        entityType: 'creator',
        entityId: event.creatorId.toString(),
        category: derivedSignals.contentCategories?.[0] || '',
        affinityScore: clamp(baseScore * 0.75 + watchBoost * 0.25, 0, 1.5),
        engagementProbability,
        rewatchProbability,
        scoreBreakdown: {
          baseScore,
          watchBoost,
        },
        metadata: {
          sourceEventType: event.eventType,
        },
      }),
    );
  }

  for (const category of derivedSignals.contentCategories || []) {
    updatedSignals.push(
      await upsertRecommendationSignal({
        userId: event.userId,
        entityType: 'category',
        entityId: category,
        category,
        affinityScore: clamp(baseScore * 0.8 + watchBoost * 0.2, 0, 1.5),
        engagementProbability,
        rewatchProbability,
        scoreBreakdown: {
          baseScore,
          watchBoost,
        },
        metadata: {
          sourceEventType: event.eventType,
        },
      }),
    );
  }

  if (event.contentId) {
    updatedSignals.push(
      await upsertRecommendationSignal({
        userId: event.userId,
        entityType: 'content',
        entityId: event.contentId,
        category: derivedSignals.contentCategories?.[0] || '',
        affinityScore: clamp(baseScore * 0.7 + watchBoost * 0.3, 0, 1.5),
        engagementProbability,
        rewatchProbability,
        scoreBreakdown: {
          baseScore,
          watchBoost,
        },
        metadata: {
          sourceEventType: event.eventType,
        },
      }),
    );
  }

  return {
    updatedCount: updatedSignals.length,
  };
}

module.exports = {
  applyRecommendationSignals,
};
