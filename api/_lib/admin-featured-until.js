/**
 * Shared admin helpers for spotlight featured_until timestamps.
 */

function hasOwn(body, key) {
  return body && Object.prototype.hasOwnProperty.call(body, key);
}

/**
 * Parse admin featured_until from a request body.
 * Empty / "none" / null → null (no expiry until manually removed).
 * Date-only YYYY-MM-DD → end of that UTC day.
 * Otherwise treat as ISO / Date-parseable string.
 * @returns {string|null} ISO timestamptz or null
 */
function parseAdminFeaturedUntil(raw) {
  if (raw == null) return null;
  if (typeof raw === 'boolean') return null;
  const text = String(raw).trim();
  if (!text || text === 'none' || text === 'null' || text === 'undefined') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const end = new Date(text + 'T23:59:59.000Z');
    if (Number.isNaN(end.getTime())) {
      const err = new Error('invalid_featured_until');
      err.status = 400;
      throw err;
    }
    return end.toISOString();
  }

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) {
    const err = new Error('invalid_featured_until');
    err.status = 400;
    throw err;
  }
  return d.toISOString();
}

/** Read featured_until / featuredUntil from a body when either key is present. */
function readFeaturedUntilFromBody(body) {
  if (hasOwn(body, 'featured_until')) return parseAdminFeaturedUntil(body.featured_until);
  if (hasOwn(body, 'featuredUntil')) return parseAdminFeaturedUntil(body.featuredUntil);
  return undefined;
}

/** True when featured flag is on and optional until has not passed. */
function isFeaturedUntilActive(row) {
  if (!row || !row.featured) return false;
  if (!row.featured_until) return true;
  const until = new Date(row.featured_until).getTime();
  return !Number.isNaN(until) && until > Date.now();
}

/**
 * Apply featured + featured_until onto a patch object for admin updates.
 * When featuring without an until key, defaults to null (no expiry) for backward compatibility.
 */
function applyAdminFeaturedPatch(patch, body, options) {
  const opts = options || {};
  const clearReminder = opts.clearReminderKey || null;
  const featuredKeyPresent = hasOwn(body, 'featured');
  const untilKeyPresent = hasOwn(body, 'featured_until') || hasOwn(body, 'featuredUntil');

  if (!featuredKeyPresent && !untilKeyPresent) return patch;

  if (featuredKeyPresent) {
    const { parseAdminBool } = require('./admin-bool');
    patch.featured = parseAdminBool(body.featured);
    if (clearReminder) patch[clearReminder] = null;
    if (!patch.featured) {
      patch.featured_until = null;
      return patch;
    }
    if (untilKeyPresent) {
      patch.featured_until = readFeaturedUntilFromBody(body);
    } else {
      patch.featured_until = null;
    }
    return patch;
  }

  // Until-only update (keep featured as-is; caller should ensure row is featured).
  patch.featured_until = readFeaturedUntilFromBody(body);
  if (clearReminder) patch[clearReminder] = null;
  return patch;
}

module.exports = {
  parseAdminFeaturedUntil,
  readFeaturedUntilFromBody,
  isFeaturedUntilActive,
  applyAdminFeaturedPatch,
};
