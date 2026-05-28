const { createSlidingWindowLimiter } = require('../../ai/utils/rateLimit');
const { getYmeConfig } = require('../config/yme.config');
const { validateEventContract } = require('../contracts/event.contract');

function selectRateLimitKey(req) {
  return req.user?.id || req.user?._id || req.ip;
}

function createYmeEventLimiter(maxPerMinute) {
  return createSlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: maxPerMinute,
    keySelector: selectRateLimitKey,
  });
}

const singleEventLimiter = createYmeEventLimiter(getYmeConfig().api.eventRateLimitPerMinute);
const batchEventLimiter = createYmeEventLimiter(getYmeConfig().api.batchRateLimitPerMinute);
const retrievalLimiter = createYmeEventLimiter(getYmeConfig().api.retrievalRateLimitPerMinute);

function validatePayloadSize(req, res, next) {
  const size = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
  if (size > getYmeConfig().api.maxPayloadBytes) {
    return res.status(413).json({
      success: false,
      message: 'YME payload too large.',
    });
  }
  return next();
}

function validateSingleEventRequest(req, res, next) {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'YME event body must be an object.',
    });
  }

  if (!req.body.eventType && !req.body.type) {
    return res.status(400).json({
      success: false,
      message: 'YME eventType is required.',
    });
  }

  const validation = validateEventContract(req.body, {
    defaults: {
      userId: req.user?._id || req.user?.id || '',
      sourceApp: req.body?.sourceApp || req.body?.source || '',
    },
  });
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid YME event payload.',
      errors: validation.errors,
    });
  }

  return next();
}

function validateBatchEventRequest(req, res, next) {
  const events = req.body?.events;
  if (!Array.isArray(events) || !events.length) {
    return res.status(400).json({
      success: false,
      message: 'YME batch events must be a non-empty array.',
    });
  }

  if (events.length > getYmeConfig().api.batchLimit) {
    return res.status(400).json({
      success: false,
      message: `YME batch exceeds limit of ${getYmeConfig().api.batchLimit} events.`,
    });
  }

  const errors = [];
  events.forEach((event, index) => {
    const validation = validateEventContract(event, {
      defaults: {
        userId: req.user?._id || req.user?.id || '',
        sourceApp: event?.sourceApp || event?.source || '',
      },
    });
    if (!validation.valid) {
      errors.push({
        index,
        errors: validation.errors,
      });
    }
  });
  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: 'YME batch contains malformed events.',
      errors,
    });
  }

  return next();
}

function validateRetrieveRequest(req, res, next) {
  const query = String(req.body?.query || req.query?.query || '').trim();
  if (query.length > getYmeConfig().api.eventTextLimit) {
    return res.status(400).json({
      success: false,
      message: 'YME retrieval query is too long.',
    });
  }
  return next();
}

module.exports = {
  singleEventLimiter,
  batchEventLimiter,
  retrievalLimiter,
  validatePayloadSize,
  validateSingleEventRequest,
  validateBatchEventRequest,
  validateRetrieveRequest,
};
