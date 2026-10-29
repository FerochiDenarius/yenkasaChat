const logger = require('../observability/logger');

module.exports = function errorHandler(err, req, res, _next) {
  const statusCode = Number(err.statusCode || err.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  logger.error('Request failed', err, {
    requestId: req.requestId,
    method: req.method,
    route: req.originalUrl,
    statusCode: safeStatusCode,
  });

  res.status(safeStatusCode).json({
    error: safeStatusCode === 500 ? 'Internal server error' : err.message,
    code: err.code || undefined,
    fields: err.fields || undefined,
    requestId: req.requestId,
  });
};
