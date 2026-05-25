const { publishEvent } = require('../yme/core/eventBus');
const {
  buildRequestMetadata,
  getRouteGroupFromPath,
  normalizePath,
  resolveUserId,
} = require('../yme/observability/observability.utils');

const LATENCY_WARN_MS = Math.max(250, Number(process.env.YENKASA_API_LATENCY_WARN_MS || 1200));
const LATENCY_ERROR_MS = Math.max(LATENCY_WARN_MS, Number(process.env.YENKASA_API_LATENCY_ERROR_MS || 3000));

function shouldTrackRequest(pathname = '', method = '') {
  if (String(method || '').toUpperCase() === 'OPTIONS') return false;
  const normalizedPath = normalizePath(pathname);
  if (normalizedPath === '/health') return false;
  if (normalizedPath.startsWith('/public/')) return false;
  return normalizedPath.startsWith('/api/') || normalizedPath.startsWith('/triciabales-api/api/');
}

function buildApiCompletionEvent(req, res, responseBody, latencyMs) {
  const metadata = buildRequestMetadata(req, responseBody, {
    statusCode: res.statusCode,
    latencyMs,
  });

  return {
    category: 'analytics_event',
    eventName: 'api_request_completed',
    severity: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    traceId: metadata.traceId,
    userId: metadata.userId,
    sourceApp: 'social_app',
    sourceModule: `http.${metadata.routeGroup}`,
    routePath: metadata.path,
    routeGroup: metadata.routeGroup,
    httpMethod: metadata.method,
    statusCode: res.statusCode,
    latencyMs,
    clientPlatform: metadata.clientPlatform,
    appVersion: metadata.appVersion,
    metadata,
  };
}

function buildAuthEvent(req, res, responseBody, latencyMs) {
  const path = normalizePath(req.originalUrl || req.url || '');
  const action = path.includes('/login')
    ? 'login'
    : path.includes('/register')
      ? 'register'
      : path.includes('/logout')
        ? 'logout'
        : 'auth';
  const success = res.statusCode < 400;
  const metadata = buildRequestMetadata(req, responseBody, {
    statusCode: res.statusCode,
    latencyMs,
    action,
  });

  return {
    category: 'auth_event',
    eventName: success ? `auth_${action}_success` : `auth_${action}_failure`,
    severity: success ? 'info' : res.statusCode >= 500 ? 'error' : 'warn',
    traceId: metadata.traceId,
    userId: metadata.userId,
    sourceApp: 'social_app',
    sourceModule: 'http.auth',
    routePath: metadata.path,
    routeGroup: metadata.routeGroup,
    httpMethod: metadata.method,
    statusCode: res.statusCode,
    latencyMs,
    metadata,
  };
}

function buildPathSpecificEvents(req, res, responseBody, latencyMs) {
  const pathname = normalizePath(req.originalUrl || req.url || '');
  const routeGroup = getRouteGroupFromPath(pathname);
  const success = res.statusCode < 400;
  const userId = resolveUserId(req, responseBody);
  const baseMetadata = buildRequestMetadata(req, responseBody, {
    statusCode: res.statusCode,
    latencyMs,
  });
  const events = [];

  if (routeGroup === 'ads' && success && req.method === 'POST') {
    const adId = req.params?.adId || req.body?.adId || '';
    if (pathname.includes('/view/')) {
      events.push({
        category: 'engagement',
        eventName: 'ad_view',
        eventType: 'ad_interaction',
        ymeEligible: Boolean(userId),
        userId,
        contentId: String(adId || ''),
        sourceApp: 'social_app',
        sourceModule: 'http.ads',
        routePath: pathname,
        routeGroup,
        httpMethod: req.method,
        statusCode: res.statusCode,
        latencyMs,
        metadata: {
          ...baseMetadata,
          adId: String(adId || ''),
          action: 'view',
        },
      });
    } else if (pathname.includes('/reward-click/')) {
      events.push({
        category: 'engagement',
        eventName: 'ad_click',
        eventType: 'ad_engagement',
        ymeEligible: Boolean(userId),
        userId,
        contentId: String(adId || ''),
        sourceApp: 'social_app',
        sourceModule: 'http.ads',
        routePath: pathname,
        routeGroup,
        httpMethod: req.method,
        statusCode: res.statusCode,
        latencyMs,
        metadata: {
          ...baseMetadata,
          adId: String(adId || ''),
          action: 'reward_click',
        },
      });
    } else if (pathname.includes('/track-monetization')) {
      events.push({
        category: 'payment_event',
        eventName: 'ad_monetization_tracked',
        severity: 'info',
        userId,
        sourceApp: 'social_app',
        sourceModule: 'http.ads',
        routePath: pathname,
        routeGroup,
        httpMethod: req.method,
        statusCode: res.statusCode,
        latencyMs,
        metadata: {
          ...baseMetadata,
          action: 'track_monetization',
        },
      });
    }
  }

  if (routeGroup === 'notifications' && success && pathname.includes('/read')) {
    events.push({
      category: 'engagement',
      eventName: 'notification_open',
      eventType: 'notification_open',
      ymeEligible: Boolean(userId),
      userId,
      contentId: String(req.params?.notificationId || ''),
      sourceApp: 'social_app',
      sourceModule: 'http.notifications',
      routePath: pathname,
      routeGroup,
      httpMethod: req.method,
      statusCode: res.statusCode,
      latencyMs,
      metadata: baseMetadata,
    });
  }

  if (routeGroup === 'moderation' && success && pathname.includes('/report/')) {
    events.push({
      category: 'moderation_event',
      eventName: 'user_report_created',
      severity: 'warn',
      userId,
      relatedUserId: String(req.params?.userId || ''),
      sourceApp: 'social_app',
      sourceModule: 'http.moderation',
      routePath: pathname,
      routeGroup,
      httpMethod: req.method,
      statusCode: res.statusCode,
      latencyMs,
      metadata: baseMetadata,
    });
  }

  if (pathname.includes('/upload') && success) {
    events.push({
      category: 'analytics_event',
      eventName: 'upload_completed',
      severity: 'info',
      userId,
      sourceApp: 'social_app',
      sourceModule: `http.${routeGroup}`,
      routePath: pathname,
      routeGroup,
      httpMethod: req.method,
      statusCode: res.statusCode,
      latencyMs,
      metadata: {
        ...baseMetadata,
        hasMultipart: String(req.headers['content-type'] || '').includes('multipart/form-data'),
      },
    });
  }

  return events;
}

module.exports = function observabilityMiddleware(req, res, next) {
  if (!shouldTrackRequest(req.originalUrl || req.url || '', req.method)) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body) {
    res.locals.responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const latencyMs = Math.max(0, Date.now() - Number(req.requestStartedAt || Date.now()));
    const pathname = normalizePath(req.originalUrl || req.url || '');
    const responseBody = res.locals.responseBody || null;

    publishEvent(buildApiCompletionEvent(req, res, responseBody, latencyMs));

    if (pathname.includes('/api/auth/') || pathname.includes('/triciabales-api/api/auth/')) {
      publishEvent(buildAuthEvent(req, res, responseBody, latencyMs));
    }

    for (const event of buildPathSpecificEvents(req, res, responseBody, latencyMs)) {
      publishEvent(event);
    }

    if (latencyMs >= LATENCY_WARN_MS) {
      publishEvent({
        category: 'infrastructure_event',
        eventName: 'api_latency_spike',
        severity: latencyMs >= LATENCY_ERROR_MS ? 'error' : 'warn',
        traceId: req.traceId,
        userId: resolveUserId(req, responseBody),
        sourceApp: 'social_app',
        sourceModule: `http.${getRouteGroupFromPath(pathname)}`,
        routePath: pathname,
        routeGroup: getRouteGroupFromPath(pathname),
        httpMethod: req.method,
        statusCode: res.statusCode,
        latencyMs,
        metadata: buildRequestMetadata(req, responseBody, {
          statusCode: res.statusCode,
          latencyMs,
        }),
      });
    }

    if (res.statusCode >= 500) {
      publishEvent({
        category: 'api_failure',
        eventName: 'api_request_failed',
        severity: 'error',
        traceId: req.traceId,
        userId: resolveUserId(req, responseBody),
        sourceApp: 'social_app',
        sourceModule: `http.${getRouteGroupFromPath(pathname)}`,
        routePath: pathname,
        routeGroup: getRouteGroupFromPath(pathname),
        httpMethod: req.method,
        statusCode: res.statusCode,
        latencyMs,
        metadata: buildRequestMetadata(req, responseBody, {
          statusCode: res.statusCode,
          latencyMs,
        }),
      });
    }
  });

  next();
};
