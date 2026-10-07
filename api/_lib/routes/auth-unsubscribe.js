/**
 * Public unsubscribe.
 * - POST JSON { token } or { email } from the unsubscribe page
 * - POST application/x-www-form-urlencoded List-Unsubscribe=One-Click (RFC 8058)
 * - GET with ?t= only checks the token; it does not unsubscribe (mail scanners prefetch GET)
 */
const { json, setCors } = require('../auth');
const { useSupabase } = require('../supabase');
const { enforceRateLimitAsync } = require('../rate-limit');
const { verifyUnsubscribeToken, maskEmail } = require('../unsubscribe-token');
const { applyEmailUnsubscribe, isEmail } = require('../email-unsubscribe');

function readBody(req) {
  let body = req.body;
  if (body == null) return {};
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { raw: trimmed };
      }
    }
    const params = new URLSearchParams(trimmed);
    const out = { raw: trimmed };
    params.forEach(function (value, key) {
      out[key] = value;
    });
    return out;
  }
  if (typeof body === 'object') return body;
  return {};
}

function requestUrl(req) {
  try {
    return new URL(req.url || '/', 'https://internal.local');
  } catch {
    return new URL('https://internal.local/');
  }
}

function isOneClick(body) {
  if (!body || typeof body !== 'object') return false;
  const flagged = body['List-Unsubscribe'] || body['list-unsubscribe'] || body.raw;
  return String(flagged || '').trim() === 'One-Click';
}

function wantsHtml(req) {
  const type = String(req.headers['content-type'] || req.headers['Content-Type'] || '').toLowerCase();
  if (type.includes('application/json')) return false;
  return type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data');
}

function resultHtml(message) {
  const safe = String(message || 'You are unsubscribed.')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return (
    '<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    '<title>Unsubscribed – The Networker UK</title>' +
    '<style>body{margin:0;font-family:system-ui,sans-serif;background:#f6f3f8;color:#1c2040}' +
    'main{max-width:440px;margin:64px auto;padding:28px;background:#fff;border-radius:16px}' +
    'a{color:#452d5c}</style></head><body><main><h1>Unsubscribed</h1><p>' +
    safe +
    '</p><p><a href="/">Back to The Networker UK</a></p></main></body></html>'
  );
}

function sendHtml(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(resultHtml(message));
}

async function handlePost(req, res) {
  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Unsubscribe is not available right now. Email hi@thenetworkeruk.com and we will remove you.',
    });
  }

  const url = requestUrl(req);
  const body = readBody(req);
  const oneClick = isOneClick(body);
  const token = String(body.t || body.token || url.searchParams.get('t') || '').trim();
  let email = String(body.email || '').trim().toLowerCase();

  if (token) {
    const parsed = verifyUnsubscribeToken(token);
    if (!parsed) {
      const message = 'This unsubscribe link has expired. Enter your email on the unsubscribe page.';
      if (oneClick) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(message);
        return;
      }
      if (wantsHtml(req)) return sendHtml(res, 400, message);
      return json(res, 400, { error: 'invalid_token', message });
    }
    email = parsed.email;
  }

  if (!isEmail(email)) {
    const message = 'Enter the email address that received the message.';
    if (wantsHtml(req)) return sendHtml(res, 400, message);
    return json(res, 400, { error: 'invalid_email', message });
  }

  if (!token) {
    const ipLimited = await enforceRateLimitAsync(req, res, 'unsubscribe_ip', {
      max: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipLimited.allowed) {
      const message = 'Too many attempts. Wait a few minutes and try again.';
      if (wantsHtml(req)) return sendHtml(res, 429, message);
      return json(res, 429, {
        error: 'rate_limited',
        message,
        retryAfterSec: ipLimited.retryAfterSec,
      });
    }
  }

  const limited = await enforceRateLimitAsync(req, res, 'unsubscribe_email', {
    max: 8,
    windowMs: 60 * 60 * 1000,
    identity: email,
  });
  if (!limited.allowed) {
    const message = 'Too many attempts for this email. Wait a while and try again.';
    if (oneClick) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(message);
      return;
    }
    if (wantsHtml(req)) return sendHtml(res, 429, message);
    return json(res, 429, { error: 'rate_limited', message, retryAfterSec: limited.retryAfterSec });
  }

  try {
    await applyEmailUnsubscribe(email);
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Could not unsubscribe. Email hi@thenetworkeruk.com and we will remove you.';
    if (oneClick) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(message);
      return;
    }
    if (wantsHtml(req)) return sendHtml(res, status, message);
    return json(res, status, { error: err.code || 'unsubscribe_failed', message });
  }

  const message =
    'You are unsubscribed. Tips, recommendations, group roundups, and other optional emails will stop. Booking confirmations and other service messages still arrive.';

  if (oneClick) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end('Unsubscribed');
    return;
  }
  if (wantsHtml(req)) return sendHtml(res, 200, message);
  return json(res, 200, { ok: true, message, emailMasked: maskEmail(email) });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const token = requestUrl(req).searchParams.get('t') || '';
    if (!token) {
      return json(res, 200, { ok: true, mode: 'email' });
    }
    const parsed = verifyUnsubscribeToken(token);
    if (!parsed) {
      return json(res, 400, {
        error: 'invalid_token',
        message: 'This unsubscribe link has expired. Enter your email address instead.',
      });
    }
    return json(res, 200, { ok: true, mode: 'token', emailMasked: maskEmail(parsed.email) });
  }

  if (req.method === 'POST') return handlePost(req, res);
  return json(res, 405, { error: 'method_not_allowed' });
};
