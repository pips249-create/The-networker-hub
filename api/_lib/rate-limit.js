/**
 * Lightweight in-memory rate limiter (per serverless instance).
 * Helps slow brute-force attempts on auth and preview endpoints.
 */
const buckets = new Map();

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || '').trim() || 'unknown';
}

function rateLimit(key, options) {
  const max = options?.max ?? 12;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  const bucketKey = String(key || 'unknown');
  let bucket = buckets.get(bucketKey);

  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;

  if (bucket.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000));
    return {
      allowed: false,
      retryAfterSec,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, max - bucket.count),
  };
}

function enforceRateLimit(req, res, scope, options) {
  const ip = clientIp(req);
  const result = rateLimit(scope + ':' + ip, options);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    return result;
  }
  return result;
}

module.exports = {
  clientIp,
  rateLimit,
  enforceRateLimit,
};
