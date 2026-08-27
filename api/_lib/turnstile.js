/**
 * Cloudflare Turnstile — optional bot protection for public forms.
 * When TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY are unset, verification is skipped
 * so local/dev and pre-key deploys keep working.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function getTurnstileSiteKey() {
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

function getTurnstileSecretKey() {
  return String(process.env.TURNSTILE_SECRET_KEY || '').trim();
}

function isTurnstileEnabled() {
  return Boolean(getTurnstileSiteKey() && getTurnstileSecretKey());
}

/**
 * @param {string} token
 * @param {string} [remoteip]
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string, codes?: string[] }>}
 */
async function verifyTurnstileToken(token, remoteip) {
  if (!isTurnstileEnabled()) {
    return { ok: true, skipped: true };
  }

  const responseToken = String(token || '').trim();
  if (!responseToken) {
    return { ok: false, error: 'captcha_required' };
  }

  const body = new URLSearchParams();
  body.set('secret', getTurnstileSecretKey());
  body.set('response', responseToken);
  if (remoteip && remoteip !== 'unknown') body.set('remoteip', remoteip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok || !data) {
      return { ok: false, error: 'captcha_verify_failed' };
    }
    if (data.success === true) {
      return { ok: true };
    }
    const codes = Array.isArray(data['error-codes']) ? data['error-codes'] : [];
    return { ok: false, error: 'captcha_failed', codes: codes };
  } catch (e) {
    return { ok: false, error: 'captcha_verify_failed', message: e.message };
  }
}

function turnstilePublicConfig() {
  const enabled = isTurnstileEnabled();
  return {
    enabled: enabled,
    siteKey: enabled ? getTurnstileSiteKey() : '',
  };
}

module.exports = {
  getTurnstileSiteKey,
  getTurnstileSecretKey,
  isTurnstileEnabled,
  verifyTurnstileToken,
  turnstilePublicConfig,
};
