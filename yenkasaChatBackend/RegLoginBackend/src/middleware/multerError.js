const multer = require('multer');
const { publishEvent } = require('../yme/core/eventBus');
const {
  buildRequestMetadata,
  emitStructuredAppLog,
} = require('../yme/observability/observability.utils');

module.exports = function multerError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const metadata = buildRequestMetadata(req, null, {
      statusCode: 400,
      errorMessage: err.message,
    });
    emitStructuredAppLog({
      severity: 'WARN',
      component: 'app.upload',
      message: 'Multer upload error.',
      data: {
        traceId: metadata.traceId,
        routePath: metadata.path,
        userId: metadata.userId || null,
        errorMessage: err.message,
      },
    });
    publishEvent({
      category: 'upload_failure',
      eventName: 'multer_upload_error',
      severity: 'warn',
      traceId: metadata.traceId,
      userId: metadata.userId,
      sourceApp: 'social_app',
      sourceModule: 'express.multer',
      routePath: metadata.path,
      routeGroup: metadata.routeGroup,
      httpMethod: metadata.method,
      statusCode: 400,
      metadata,
      payload: { message: err.message, code: err.code || '' },
    });
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  if (err?.message === 'Unsupported file type') {
    const metadata = buildRequestMetadata(req, null, {
      statusCode: 400,
      errorMessage: err.message,
    });
    publishEvent({
      category: 'upload_failure',
      eventName: 'unsupported_upload_file_type',
      severity: 'warn',
      traceId: metadata.traceId,
      userId: metadata.userId,
      sourceApp: 'social_app',
      sourceModule: 'express.multer',
      routePath: metadata.path,
      routeGroup: metadata.routeGroup,
      httpMethod: metadata.method,
      statusCode: 400,
      metadata,
      payload: { message: err.message },
    });
    return res.status(400).json({ error: err.message });
  }
  next(err);
};
