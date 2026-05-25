const { publishEvent } = require('../yme/core/eventBus');
const {
  buildRequestMetadata,
  emitStructuredAppLog,
  sanitizeError,
} = require('../yme/observability/observability.utils');

module.exports = function errorHandler(err, req, res, next) {
  const statusCode = Number(err?.status || err?.statusCode || 500);
  const metadata = buildRequestMetadata(req, null, {
    statusCode,
    error: sanitizeError(err),
  });

  emitStructuredAppLog({
    severity: statusCode >= 500 ? 'ERROR' : 'WARN',
    component: 'app.error_handler',
    message: 'Unhandled express error.',
    data: {
      traceId: metadata.traceId,
      routePath: metadata.path,
      routeGroup: metadata.routeGroup,
      statusCode,
      userId: metadata.userId || null,
      error: metadata.error,
    },
  });

  publishEvent({
    category: statusCode >= 500 ? 'system_error' : 'api_failure',
    eventName: 'unhandled_request_error',
    severity: statusCode >= 500 ? 'error' : 'warn',
    traceId: metadata.traceId,
    userId: metadata.userId,
    sourceApp: 'social_app',
    sourceModule: 'express.error_handler',
    routePath: metadata.path,
    routeGroup: metadata.routeGroup,
    httpMethod: metadata.method,
    statusCode,
    metadata,
    payload: metadata.error || {},
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: statusCode < 500 && err?.message ? err.message : 'Internal server error',
  });
};
