/**
 * Rate limiter — in-memory per instance, plus optional durable Supabase buckets
 * for auth / site-access (survives cold starts and multi-instance fan-out).
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

/**
 * Prefer shared Supabase buckets; fall back to in-memory if RPC unavailable.
 * Use on login / register / password / site-access.
 */
async function enforceRateLimitAsync(req, res, scope, options) {
  const max = options?.max ?? 12;
  const windowMs = options?.windowMs ?? 60_000;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const ip = clientIp(req);
  const key = String(scope || 'unknown') + ':' + ip;

  try {
    const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
    if (isSupabaseConfigured()) {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb.rpc('consume_rate_limit', {
        p_key: key.slice(0, 200),
        p_max: max,
        p_window_seconds: windowSeconds,
      });
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        const allowed = row?.allowed !== false;
        const retryAfterSec = Math.max(0, Number(row?.retry_after_sec) || 0);
        const remaining = Math.max(0, Number(row?.remaining) || 0);
        if (!allowed) {
          res.setHeader('Retry-After', String(retryAfterSec || 1));
          return { allowed: false, retryAfterSec: retryAfterSec || 1, remaining: 0, durable: true };
        }
        return { allowed: true, retryAfterSec: 0, remaining, durable: true };
      }
    }
  } catch (_) {
    /* fall through to memory */
  }

  return { ...enforceRateLimit(req, res, scope, options), durable: false };
}

module.exports = {
  clientIp,
  rateLimit,
  enforceRateLimit,
  enforceRateLimitAsync,
};
