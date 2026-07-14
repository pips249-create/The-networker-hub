const crypto = require('crypto');

/**
 * Constant-time string comparison (UTF-8). Length mismatch returns false without leaking which side differs.
 */
function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

module.exports = {
  timingSafeEqualString,
};
