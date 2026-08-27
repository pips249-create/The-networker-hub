#!/usr/bin/env node
/**
 * Smoke the security hardening paths (rate limits, password policy, Turnstile skip).
 * Usage: node scripts/smoke-test-security.js [baseUrl]
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const base = (process.argv[2] || 'http://localhost:3002').replace(/\/$/, '');
let failed = 0;
let passed = 0;

function ok(label, detail) {
  passed += 1;
  console.log('  OK   ' + label + (detail ? ' — ' + detail : ''));
}

function fail(label, detail) {
  failed += 1;
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
}

async function postJson(pathname, body, headers) {
  const res = await fetch(base + pathname, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data, headers: res.headers };
}

async function get(pathname) {
  const res = await fetch(base + pathname, { cache: 'no-store' });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function main() {
  console.log('Security smoke →', base);

  // Unit: password policy (no server)
  const { validateNewPassword } = require('../api/_lib/password-policy');
  if (!validateNewPassword('short').ok) ok('password rejects short');
  else fail('password rejects short');
  if (!validateNewPassword('lettersonly').ok) ok('password rejects letters-only');
  else fail('password rejects letters-only');
  if (validateNewPassword('letters1234').ok) ok('password accepts 10+ with letter+number');
  else fail('password accepts 10+ with letter+number');

  // Pages load
  for (const p of ['/login', '/register', '/reset-password', '/forgot-password']) {
    const r = await get(p);
    if (r.status === 200 && /password|sign|account/i.test(r.text)) ok('page ' + p, 'HTTP ' + r.status);
    else fail('page ' + p, 'HTTP ' + r.status);
  }

  // Scripts present on auth pages
  const login = await get('/login');
  if (/hub-turnstile\.js/.test(login.text) && /auth\.js\?v=20260827sec3/.test(login.text)) {
    ok('login includes turnstile + cache-busted auth.js');
  } else {
    fail('login includes turnstile + cache-busted auth.js');
  }
  const register = await get('/register');
  if (/hub-turnstile\.js/.test(register.text) && /minlength="10"/.test(register.text)) {
    ok('register includes turnstile + minlength 10');
  } else {
    fail('register includes turnstile + minlength 10');
  }

  // public-config turnstile shape
  const cfg = await get('/api/public-config');
  let cfgJson = null;
  try {
    cfgJson = JSON.parse(cfg.text);
  } catch (_) {}
  if (cfg.status === 200 && cfgJson && cfgJson.turnstile && typeof cfgJson.turnstile.enabled === 'boolean') {
    ok('public-config turnstile', 'enabled=' + cfgJson.turnstile.enabled);
  } else {
    fail('public-config turnstile', 'HTTP ' + cfg.status);
  }

  // Login: missing credentials
  {
    const r = await postJson('/api/auth/login', {});
    if (r.status === 400 && r.data.error === 'missing_credentials') ok('login missing credentials');
    else fail('login missing credentials', JSON.stringify(r.data));
  }

  // Login: wrong password should be 401 (not 500) — proves handler + rate limit path runs
  {
    const r = await postJson('/api/auth/login', {
      email: 'smoke-security-nonexistent-' + Date.now() + '@example.com',
      password: 'WrongPass12',
    });
    if (r.status === 401 || r.status === 429 || (r.status === 503 && r.data.error === 'not_configured')) {
      ok('login bad creds handled', 'HTTP ' + r.status + ' ' + (r.data.error || ''));
    } else {
      fail('login bad creds handled', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
    }
  }

  // Register: weak password rejected before create
  {
    const r = await postJson('/api/auth/register', {
      email: 'smoke-weak-' + Date.now() + '@example.com',
      password: 'short',
      name: 'Smoke',
    });
    if (r.status === 400 && r.data.error === 'weak_password') ok('register rejects weak password');
    else fail('register rejects weak password', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
  }

  // Register: letters-only rejected
  {
    const r = await postJson('/api/auth/register', {
      email: 'smoke-letters-' + Date.now() + '@example.com',
      password: 'abcdefghij',
      name: 'Smoke',
    });
    if (r.status === 400 && r.data.error === 'weak_password') ok('register rejects letters-only');
    else fail('register rejects letters-only', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
  }

  // Reset password: weak rejected
  {
    const r = await postJson('/api/auth/reset-password', {
      accessToken: 'not-a-real-token',
      password: 'short',
    });
    if (r.status === 400 && r.data.error === 'weak_password') ok('reset rejects weak password');
    else if (r.status === 429) ok('reset rate-limited (still healthy)', 'HTTP 429');
    else fail('reset rejects weak password', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
  }

  // Checkout: missing email still 400 (rate limit must not break validation path)
  {
    const r = await postJson('/api/auth/create-checkout', { name: 'Smoke Tester' });
    if (r.status === 400 && (r.data.error === 'missing_email' || r.data.ok === false)) {
      ok('checkout missing email', 'HTTP ' + r.status + ' ' + (r.data.error || ''));
    } else {
      fail('checkout missing email', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
    }
  }

  // Checkout: with email hits rate-limit-then-validation (invalid event)
  {
    const r = await postJson('/api/auth/create-checkout', {
      email: 'smoke-checkout-' + Date.now() + '@example.com',
      name: 'Smoke Tester',
      eventId: 'not-a-uuid',
    });
    if (
      r.status === 400 ||
      r.status === 429 ||
      (r.status === 503 && r.data.error === 'supabase_not_configured')
    ) {
      ok('checkout invalid event handled', 'HTTP ' + r.status + ' ' + (r.data.error || ''));
    } else {
      fail('checkout invalid event handled', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
    }
  }

  // Contact chat rate-limit path
  {
    const r = await postJson('/api/contact-chat', {
      messages: [{ role: 'user', content: 'Hello smoke security check' }],
    });
    if (r.status === 200 && r.data.ok && r.data.reply) {
      ok('contact-chat replies', 'mode=' + (r.data.mode || '?'));
    } else if (r.status === 429) {
      ok('contact-chat rate-limited', 'HTTP 429');
    } else {
      fail('contact-chat replies', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
    }
  }

  // Organiser claim: missing fields after durable RL
  {
    const r = await postJson('/api/organisers', { action: 'claim_request' });
    if (
      r.status === 400 ||
      r.status === 429 ||
      (r.status === 503 && r.data.error === 'not_configured')
    ) {
      ok('organiser claim validation/RL', 'HTTP ' + r.status + ' ' + (r.data.error || ''));
    } else {
      fail('organiser claim validation/RL', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
    }
  }

  // Opportunity enquiry: unauthenticated after durable RL
  {
    const r = await postJson('/api/opportunities', {
      action: 'enquiry',
      opportunityId: '00000000-0000-0000-0000-000000000001',
      name: 'Smoke',
      email: 'smoke@example.com',
      message: 'hi',
    });
    if (r.status === 401 || r.status === 404 || r.status === 400 || r.status === 429) {
      ok('opportunity enquiry gated', 'HTTP ' + r.status + ' ' + (r.data.error || ''));
    } else {
      fail('opportunity enquiry gated', 'HTTP ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 180));
    }
  }

  console.log('');
  console.log(failed ? failed + ' failed, ' + passed + ' passed' : 'All ' + passed + ' checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
