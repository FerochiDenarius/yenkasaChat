const { normalizeText } = require('../utils/textNormalizer');
const { summarizeTopScored } = require('../utils/yme.utils');

function summarizeBehaviorEvents(events = [], derivedSignals = {}) {
  const eventCounts = {};
  let watchTimeMs = 0;
  let scrollDurationMs = 0;

  for (const event of events) {
    const eventType = String(event?.eventType || 'unknown');
    eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
    watchTimeMs += Number(event?.eventMetadata?.watchTimeMs || 0);
    scrollDurationMs += Number(event?.eventMetadata?.scrollDurationMs || 0);
  }

  const topEventTypes = Object.entries(eventCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([eventType, count]) => `${eventType} (${count})`);

  const topInterests = summarizeTopScored(derivedSignals.interests, 'label', 5);
  const topCommerceSignals = summarizeTopScored(derivedSignals.commerceSignals, 'label', 4);

  const lines = [
    topEventTypes.length ? `Recent engagement: ${topEventTypes.join(', ')}` : '',
    topInterests.length ? `Current interests: ${topInterests.join(', ')}` : '',
    topCommerceSignals.length ? `Commerce intent: ${topCommerceSignals.join(', ')}` : '',
    watchTimeMs > 0 ? `Watch time in window: ${Math.round(watchTimeMs / 1000)}s` : '',
    scrollDurationMs > 0 ? `Scroll activity in window: ${Math.round(scrollDurationMs / 1000)}s` : '',
  ].filter(Boolean);

  return {
    summary: lines.join('. '),
    eventCounts,
    watchTimeMs,
    scrollDurationMs,
  };
}

function summarizeChatEvents(events = []) {
  const orderedEvents = [...events].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
  const compact = orderedEvents
    .map((event) => {
      const role =
        String(event?.eventType || '').includes('response') || event?.sourceApp === 'system'
          ? 'assistant'
          : 'user';
      const text = normalizeText(event?.normalizedText || '');
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .slice(-8);

  if (!compact.length) {
    return {
      summary: '',
      sentiment: 'neutral',
    };
  }

  const summary = compact.join(' | ');
  const lowered = summary.toLowerCase();
  let sentiment = 'neutral';
  if (/(happy|great|love|excited|good news)/.test(lowered)) sentiment = 'positive';
  if (/(angry|frustrated|sad|annoyed|problem)/.test(lowered)) sentiment = 'negative';

  return {
    summary: summary.length > 900 ? `${summary.slice(0, 897)}...` : summary,
    sentiment,
  };
}

function buildEventNarrative(event, derivedSignals = {}) {
  const safeText = normalizeText(event?.normalizedText || '');
  const parts = [
    `Event ${event.eventType} from ${event.sourceApp}`,
    safeText ? `Text: ${safeText}` : '',
    derivedSignals.interests?.length
      ? `Interests: ${summarizeTopScored(derivedSignals.interests, 'label', 5).join(', ')}`
      : '',
    event.creatorId ? `Creator: ${event.creatorId.toString()}` : '',
    event.contentId ? `Content: ${event.contentId}` : '',
  ].filter(Boolean);

  return parts.join('. ');
}

module.exports = {
  summarizeBehaviorEvents,
  summarizeChatEvents,
  buildEventNarrative,
};
