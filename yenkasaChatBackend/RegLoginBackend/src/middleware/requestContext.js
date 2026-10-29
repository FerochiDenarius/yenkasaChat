const crypto = require('node:crypto');

module.exports = function requestContext(req, res, next) {
  const suppliedRequestId = String(req.get('x-request-id') || '').trim();
  req.requestId = suppliedRequestId.slice(0, 128) || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};
