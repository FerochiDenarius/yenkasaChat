function createSlidingWindowLimiter({ windowMs, max, keySelector }) {
  const buckets = new Map();

  function prune(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (!bucket || now - bucket.windowStart >= windowMs) {
        buckets.delete(key);
      }
    }
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    prune(now);

    const key = String(keySelector(req) || req.ip || 'anonymous');
    const existing = buckets.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (existing.count >= max) {
      return res.status(429).json({
        success: false,
        message: 'AI rate limit exceeded. Please wait before sending another request.'
      });
    }

    existing.count += 1;
    return next();
  };
}

function createAiRateLimiter() {
  return createSlidingWindowLimiter({
    windowMs: 60 * 1000,
    max: 20,
    keySelector: (req) => req.user?.id || req.user?._id || req.ip
  });
}

module.exports = {
  createSlidingWindowLimiter,
  createAiRateLimiter
};
