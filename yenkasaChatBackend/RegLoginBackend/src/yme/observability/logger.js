const {
  buildRequestMetadata,
  buildTraceId,
  emitStructuredAppLog,
  sanitizeError,
} = require('./observability.utils');

function normalizeSeverity(value = 'INFO') {
  return String(value || 'INFO').trim().toUpperCase();
}

function normalizeEventSeverity(value = 'info') {
  return String(value || 'info').trim().toLowerCase();
}

function buildMetadata({ req, traceId, userId, data = {} } = {}) {
  if (!req) {
    return {
      traceId: buildTraceId(traceId),
      userId: String(userId || '').trim(),
      routeGroup: '',
      path: '',
      method: '',
      clientPlatform: '',
      appVersion: '',
      ip: '',
      userAgent: '',
      ...data,
    };
  }

  return buildRequestMetadata(req, null, data);
}

function emitLog({
  severity = 'INFO',
  component,
  sourceModule,
  message,
  req,
  traceId,
  userId,
  data = {},
  error,
} = {}) {
  if (!message) return null;

  const metadata = buildMetadata({ req, traceId, userId, data });
  const resolvedUserId = String(userId || metadata.userId || '').trim();

  emitStructuredAppLog({
    severity: normalizeSeverity(severity),
    component,
    message,
    data: {
      traceId: metadata.traceId,
      userId: resolvedUserId || null,
      sourceModule: sourceModule || component,
      routePath: metadata.path || '',
      routeGroup: metadata.routeGroup || '',
      httpMethod: metadata.method || '',
      clientPlatform: metadata.clientPlatform || '',
      appVersion: metadata.appVersion || '',
      ip: metadata.ip || '',
      userAgent: metadata.userAgent || '',
      ...data,
      ...(error ? { error: sanitizeError(error) } : {}),
    },
  });

  return {
    metadata,
    userId: resolvedUserId,
  };
}

function createLogger(component, defaults = {}) {
  const baseSourceModule = defaults.sourceModule || component;

  function resolvePublisher() {
    try {
      const { publishEvent } = require('../core/eventBus');
      return typeof publishEvent === 'function' ? publishEvent : null;
    } catch (_error) {
      return null;
    }
  }

  function log(severity, message, options = {}) {
    return emitLog({
      severity,
      component,
      sourceModule: options.sourceModule || baseSourceModule,
      message,
      req: options.req,
      traceId: options.traceId,
      userId: options.userId,
      data: options.data || {},
      error: options.error,
    });
  }

  function track({
    message,
    severity = 'INFO',
    req,
    traceId,
    userId,
    data = {},
    error,
    event = {},
  } = {}) {
    const result = emitLog({
      severity,
      component,
      sourceModule: event.sourceModule || baseSourceModule,
      message,
      req,
      traceId,
      userId,
      data,
      error,
    });

    if (!event.category || !event.eventName) {
      return result;
    }

    const metadata = result?.metadata || buildMetadata({ req, traceId, userId, data });
    const resolvedUserId = String(userId || result?.userId || metadata.userId || '').trim();
    const publishEvent = resolvePublisher();
    if (!publishEvent) {
      return result;
    }

    publishEvent({
      traceId: metadata.traceId,
      category: event.category,
      eventName: event.eventName,
      eventType: event.eventType || event.eventName,
      severity: normalizeEventSeverity(event.severity || severity),
      userId: resolvedUserId,
      relatedUserId: event.relatedUserId,
      creatorId: event.creatorId,
      communityId: event.communityId,
      contentId: event.contentId,
      conversationId: event.conversationId,
      sessionId: event.sessionId,
      sourceApp: event.sourceApp || defaults.sourceApp || 'social_app',
      sourceModule: event.sourceModule || baseSourceModule,
      routePath: event.routePath || metadata.path || '',
      routeGroup: event.routeGroup || metadata.routeGroup || '',
      httpMethod: event.httpMethod || metadata.method || '',
      statusCode: Number(event.statusCode || data.statusCode || 0),
      latencyMs: Number(event.latencyMs || data.latencyMs || 0),
      clientPlatform: event.clientPlatform || metadata.clientPlatform || '',
      appVersion: event.appVersion || metadata.appVersion || '',
      occurredAt: event.occurredAt || new Date(),
      ymeEligible: event.ymeEligible === true,
      payload: event.payload || {},
      metadata: {
        ...data,
        ...(event.metadata || {}),
        traceId: metadata.traceId,
        path: metadata.path || '',
        routeGroup: metadata.routeGroup || '',
        method: metadata.method || '',
        ip: metadata.ip || '',
      },
    });

    return result;
  }

  return {
    info: (message, options = {}) => log('INFO', message, options),
    warn: (message, options = {}) => log('WARN', message, options),
    error: (message, options = {}) => log('ERROR', message, options),
    track,
  };
}

module.exports = {
  createLogger,
};
