function sanitizeString(value, maxLength = 512) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

function sanitizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function resolveTimestamp(rawEvent = {}) {
  const candidate = rawEvent.timestamp || rawEvent.occurredAt || rawEvent.createdAt || new Date().toISOString();
  const parsed = candidate instanceof Date ? candidate : new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString();
}

function buildEventContract(rawEvent = {}, defaults = {}) {
  return {
    eventType: sanitizeString(rawEvent.eventType || rawEvent.type, 120).toLowerCase(),
    actorId: sanitizeString(rawEvent.actorId || rawEvent.userId || defaults.userId || defaults.actorId, 64),
    targetId: sanitizeString(
      rawEvent.targetId ||
        rawEvent.relatedUserId ||
        rawEvent.targetUserId ||
        rawEvent.receiverId ||
        rawEvent.creatorId ||
        rawEvent.authorId ||
        rawEvent.profileUserId,
      64,
    ),
    communityId: sanitizeString(rawEvent.communityId, 64),
    timestamp: resolveTimestamp(rawEvent),
    platform: sanitizeString(
      rawEvent.platform || rawEvent.clientPlatform || rawEvent.eventMetadata?.clientPlatform,
      64,
    ).toLowerCase(),
    source: sanitizeString(rawEvent.source || rawEvent.sourceApp || defaults.sourceApp, 64).toLowerCase(),
    sessionId: sanitizeString(rawEvent.sessionId || rawEvent.session, 128),
    deviceId: sanitizeString(rawEvent.deviceId || rawEvent.installationId, 128),
    geo: sanitizeObject(rawEvent.geo),
    metadata: sanitizeObject(rawEvent.metadata || rawEvent.payload || rawEvent.data),
  };
}

function validateEventContract(rawEvent = {}, options = {}) {
  const defaults = options.defaults || {};
  const contract = buildEventContract(rawEvent, defaults);
  const errors = [];

  if (!contract.eventType) {
    errors.push('eventType is required.');
  }

  if (!contract.actorId) {
    errors.push('actorId is required.');
  }

  if (!contract.timestamp) {
    errors.push('timestamp is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
    contract,
  };
}

module.exports = {
  buildEventContract,
  validateEventContract,
};
