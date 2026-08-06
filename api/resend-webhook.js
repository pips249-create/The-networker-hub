/**
 * Resend webhooks (Svix) — email.opened / email.clicked for sponsor packs.
 * Set RESEND_WEBHOOK_SECRET in env (whsec_… from Resend → Webhooks).
 * Endpoint: POST /api/resend-webhook
 */
const crypto = require('crypto');
const { isSupabaseConfigured } = require('./_lib/supabase');
const {
  recordSponsorEmailOpen,
  recordSponsorEmailClick,
  resolveCompaniesFromResendEmailId,
} = require('./_lib/sponsor-clicks');

const SVIX_TOLERANCE_SEC = 300;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySvixSignature(rawBody, headers, secret, toleranceSec = SVIX_TOLERANCE_SEC) {
  if (!secret || !rawBody) return false;
  const msgId = String(headers['svix-id'] || headers['webhook-id'] || '').trim();
  const msgTimestamp = String(headers['svix-timestamp'] || headers['webhook-timestamp'] || '').trim();
  const msgSignature = String(headers['svix-signature'] || headers['webhook-signature'] || '').trim();
  if (!msgId || !msgTimestamp || !msgSignature) return false;

  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return false;

  const secretPart = String(secret).startsWith('whsec_') ? String(secret).slice(6) : String(secret);
  let secretBytes;
  try {
    secretBytes = Buffer.from(secretPart, 'base64');
  } catch {
    return false;
  }
  if (!secretBytes.length) return false;

  const signedContent = msgId + '.' + msgTimestamp + '.' + rawBody;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  const candidates = msgSignature.split(/\s+/).filter(Boolean);
  for (const entry of candidates) {
    const provided = entry.startsWith('v1,') ? entry.slice(3) : entry;
    try {
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      /* continue */
    }
  }
  return false;
}

function emailIdFromEvent(event) {
  const data = (event && event.data) || {};
  return String(data.email_id || data.emailId || (data.email && data.email.id) || '').trim();
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  if (!isSupabaseConfigured()) {
    res.statusCode = 503;
    return res.end('supabase_not_configured');
  }

  const webhookSecret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
  const skipVerify =
    process.env.RESEND_WEBHOOK_SKIP_VERIFY === '1' ||
    process.env.RESEND_WEBHOOK_SKIP_VERIFY === 'local-dev';

  if (!webhookSecret) {
    if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production' || !skipVerify) {
      res.statusCode = 503;
      return res.end('webhook_secret_not_configured');
    }
  }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch {
    res.statusCode = 400;
    return res.end('invalid_body');
  }

  if (webhookSecret) {
    if (!verifySvixSignature(rawBody, req.headers || {}, webhookSecret)) {
      res.statusCode = 400;
      return res.end('invalid_signature');
    }
  } else if (!skipVerify) {
    res.statusCode = 503;
    return res.end('webhook_secret_not_configured');
  }

  let event = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    res.statusCode = 400;
    return res.end('invalid_payload');
  }

  const type = String((event && event.type) || '').trim();
  if (!type) {
    res.statusCode = 400;
    return res.end('invalid_payload');
  }

  try {
    if (type === 'email.opened' || type === 'email.clicked') {
      const emailId = emailIdFromEvent(event);
      const companies = emailId ? await resolveCompaniesFromResendEmailId(emailId) : [];
      let recorded = 0;
      for (const company of companies) {
        if (type === 'email.opened') await recordSponsorEmailOpen(company);
        else await recordSponsorEmailClick(company);
        recorded += 1;
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, type, recorded, matched: companies.length > 0 }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ignored: type }));
  } catch (err) {
    console.error('[resend-webhook]', err && err.message ? err.message : err);
    res.statusCode = 500;
    return res.end('handler_error');
  }
}

module.exports = handler;
