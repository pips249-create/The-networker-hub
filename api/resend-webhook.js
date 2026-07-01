/**
 * Resend webhook — newsletter open/click/delivery tracking.
 * Configure in Resend dashboard → Webhooks → https://your-domain/api/resend-webhook
 * Events: email.delivered, email.opened, email.clicked, email.bounced, email.failed
 * Set RESEND_WEBHOOK_SECRET (whsec_…) in Vercel env.
 */
const { isSupabaseConfigured } = require('./_lib/supabase');
const {
  verifySvixWebhook,
  processResendWebhookEvent,
} = require('./_lib/newsletter-analytics');

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (typeof req.body === 'string') {
      resolve(req.body);
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      resolve(req.body.toString('utf8'));
      return;
    }
    if (req.body && typeof req.body === 'object') {
      resolve(JSON.stringify(req.body));
      return;
    }
    const chunks = [];
    req.on('data', function (chunk) {
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
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

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch {
    res.statusCode = 400;
    return res.end('invalid_body');
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const ok = verifySvixWebhook(rawBody, req.headers || {}, webhookSecret);
    if (!ok) {
      res.statusCode = 400;
      return res.end('invalid_signature');
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    res.statusCode = 400;
    return res.end('invalid_json');
  }

  try {
    const result = await processResendWebhookEvent(null, event, {
      eventId: req.headers['svix-id'] || req.headers['Svix-Id'] || '',
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, ...result }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: e.message || 'webhook_failed' }));
  }
}

module.exports = handler;
