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

function buildBucketKey(scope, req, options) {
  if (options?.bucketKey) {
    return String(options.bucketKey).slice(0, 200);
  }
  const ip = clientIp(req);
  const identity = options?.identity != null ? String(options.identity).trim().toLowerCase() : '';
  if (identity) {
    return String(scope || 'unknown') + ':' + identity.slice(0, 120);
  }
  return String(scope || 'unknown') + ':' + ip;
}

async function consumeDurableBucket(res, key, options) {
  const max = options?.max ?? 12;
  const windowMs = options?.windowMs ?? 60_000;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const bucketKey = String(key || 'unknown').slice(0, 200);

  try {
    const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
    if (isSupabaseConfigured()) {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb.rpc('consume_rate_limit', {
        p_key: bucketKey,
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

  const result = rateLimit(bucketKey, options);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
  }
  return { ...result, durable: false };
}

/**
 * Prefer shared Supabase buckets; fall back to in-memory if RPC unavailable.
 * Use on login / register / password / site-access / public writes.
 *
 * options.identity — rate-limit by email (or other id) instead of IP
 * options.bucketKey — full bucket key override
 */
async function enforceRateLimitAsync(req, res, scope, options) {
  return consumeDurableBucket(res, buildBucketKey(scope, req, options), options);
}

/**
 * Durable consume for an explicit key (e.g. failed-login counters).
 */
async function consumeRateLimitKeyAsync(res, key, options) {
  return consumeDurableBucket(res, key, options);
}

/**
 * Read-only check — does not increment. Fails open if Supabase is unavailable
 * so a DB blip cannot lock everyone out of sign-in.
 */
async function isDurableRateLimitExceeded(key, options) {
  const max = options?.max ?? 12;
  const windowMs = options?.windowMs ?? 60_000;
  const bucketKey = String(key || '').slice(0, 200);
  if (!bucketKey) return { allowed: true, retryAfterSec: 0 };

  try {
    const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
    if (!isSupabaseConfigured()) return { allowed: true, retryAfterSec: 0 };

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('api_rate_limit_buckets')
      .select('hit_count, window_start')
      .eq('bucket_key', bucketKey)
      .maybeSingle();
    if (error || !data) return { allowed: true, retryAfterSec: 0 };

    const startMs = new Date(data.window_start).getTime();
    if (!Number.isFinite(startMs) || Date.now() - startMs >= windowMs) {
      return { allowed: true, retryAfterSec: 0 };
    }
    if (Number(data.hit_count) >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (Date.now() - startMs)) / 1000));
      return { allowed: false, retryAfterSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch (_) {
    return { allowed: true, retryAfterSec: 0 };
  }
}

module.exports = {
  clientIp,
  rateLimit,
  enforceRateLimit,
  enforceRateLimitAsync,
  consumeRateLimitKeyAsync,
  isDurableRateLimitExceeded,
};
