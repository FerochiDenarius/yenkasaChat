const { buildTraceId } = require('../yme/observability/observability.utils');

module.exports = function requestContext(req, res, next) {
  const traceId = buildTraceId(
    req.headers['x-trace-id'] || req.headers['x-request-id'] || req.headers['x-correlation-id'],
  );
  req.traceId = traceId;
  req.requestStartedAt = Date.now();
  res.setHeader('X-Trace-Id', traceId);
  next();
};
