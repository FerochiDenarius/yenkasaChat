const ChatSummary = require('../models/chatSummary.model');
const UserMemory = require('../models/userMemory.model');
const { normalizeText } = require('../utils/textNormalizer');
const { incrementCounter } = require('./metrics.service');
const { searchUserMemory } = require('./vectorSearch.service');

function rankMatches(matches = []) {
  return [...matches]
    .map((match) => ({
      ...match,
      blendedScore:
        Number(match.score || 0) * 0.7 +
        Number(match.importance || 0.5) * 0.2 +
        (match.memoryTier === 'long_term' ? 0.1 : 0.05),
    }))
    .sort((left, right) => right.blendedScore - left.blendedScore);
}

function buildContextSummary({ profile, chatSummaries, matches, recentMessages = [] }) {
  const lines = [];

  const stableInterests = (profile?.longTerm?.stableInterests || [])
    .slice(0, 5)
    .map((entry) => entry.label);
  if (stableInterests.length) {
    lines.push(`Stable interests: ${stableInterests.join(', ')}`);
  }

  const activeTopics = (profile?.shortTerm?.activeTopics || []).slice(0, 6);
  if (activeTopics.length) {
    lines.push(`Current topics: ${activeTopics.join(', ')}`);
  }

  const recentSummary = (chatSummaries || []).map((entry) => entry.summary).filter(Boolean)[0];
  if (recentSummary) {
    lines.push(`Recent chat memory: ${recentSummary}`);
  }

  if (recentMessages.length) {
    const lastTwoMessages = [...recentMessages]
      .slice(-2)
      .map((message) => {
        const safeText = normalizeText(message?.content || '');
        return safeText ? `${message.role}: ${safeText}` : '';
      })
      .filter(Boolean)
      .join(' | ');
    if (lastTwoMessages) {
      lines.push(`Immediate context: ${lastTwoMessages}`);
    }
  }

  const semanticMatches = rankMatches(matches)
    .slice(0, 4)
    .map((match) => `${match.memoryTier} ${match.sourceType}: ${match.text}`);
  if (semanticMatches.length) {
    lines.push(`Relevant memories: ${semanticMatches.join(' || ')}`);
  }

  return lines.join('\n');
}

async function retrieveUserMemoryContext({
  userId,
  query,
  conversationId = '',
  recentMessages = [],
  limit = 8,
} = {}) {
  const [profile, chatSummaries, matches] = await Promise.all([
    UserMemory.findOne({ userId }).lean(),
    conversationId
      ? ChatSummary.find({
          userId,
          conversationId,
        })
          .sort({ updatedAt: -1 })
          .limit(2)
          .lean()
      : Promise.resolve([]),
    searchUserMemory({
      userId,
      query,
      limit,
    }),
  ]);

  incrementCounter('memoryRetrievalRequests');

  return {
    profile,
    chatSummaries,
    matches: rankMatches(matches),
    contextSummary: buildContextSummary({
      profile,
      chatSummaries,
      matches,
      recentMessages,
    }),
  };
}

module.exports = {
  retrieveUserMemoryContext,
};
