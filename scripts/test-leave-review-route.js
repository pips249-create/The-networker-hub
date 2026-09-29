#!/usr/bin/env node
/**
 * The post-event review email links to /events/leave-review.html?token=…
 * cleanUrls drops .html, so the extensionless path must serve the review page
 * and must not be treated as an event slug or a soft-launch redirect.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function fail(message) {
  console.error('FAIL: ' + message);
  process.exit(1);
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites || [];
const leaveIdx = rewrites.findIndex(function (rule) {
  return rule && rule.source === '/events/leave-review' && rule.destination === '/events/leave-review.html';
});
const slugIdx = rewrites.findIndex(function (rule) {
  return rule && rule.source === '/events/:slug';
});
if (leaveIdx < 0) fail('vercel.json missing /events/leave-review rewrite');
if (slugIdx < 0) fail('vercel.json missing /events/:slug rewrite');
if (leaveIdx > slugIdx) fail('leave-review rewrite must come before /events/:slug');

const middleware = fs.readFileSync(path.join(root, 'middleware.js'), 'utf8');
const skipMatch = middleware.match(/const SKIP_EVENT_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
if (!skipMatch) fail('SKIP_EVENT_SLUGS not found');
if (!skipMatch[1].includes("'leave-review'") || !skipMatch[1].includes("'leave-review.html'")) {
  fail('leave-review must be skipped as an event slug');
}
if (!middleware.includes("path === '/events/leave-review'")) {
  fail('leave-review path helper missing');
}
if (!middleware.includes('if (isLeaveReviewPath(pathname)) return true;')) {
  fail('leave-review must bypass the site gate');
}
const bypass = middleware.match(/const GATE_BYPASS_PREFIXES = \[([\s\S]*?)\];/);
if (!bypass || !bypass[1].includes("'/api/email-review'")) {
  fail('/api/email-review must bypass the site gate so the form can load without cookies');
}

const page = fs.readFileSync(path.join(root, 'events/leave-review.html'), 'utf8');
if (!page.includes('email-leave-review.js')) fail('review page missing its script');

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signSession(payload, secret) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = require('crypto').createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

async function assertReviewRoutes() {
  process.env.SITE_ACCESS_PASSWORD = 'preview-secret';
  process.env.SESSION_SECRET = 'test-session-secret-for-review-routes';
  delete process.env.DISABLE_SITE_ACCESS_GATE;

  const middleware = (await import(pathToFileURL(path.join(root, 'middleware.js')).href)).default;
  const secret = process.env.SESSION_SECRET;
  const session = signSession(
    {
      email: 'catherine@example.com',
      role: 'organiser',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret
  );

  async function run(url, cookie) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    return middleware(new Request(url, { headers: headers }));
  }

  function locationOf(res) {
    return res instanceof Response ? String(res.headers.get('location') || '') : '';
  }

  const anonReview = await run('http://127.0.0.1/events/leave-review?token=abc');
  if (anonReview instanceof Response) {
    fail('anonymous review link was blocked (' + anonReview.status + ' ' + locationOf(anonReview) + ')');
  }

  const anonHtml = await run('http://127.0.0.1/events/leave-review.html?token=abc');
  if (anonHtml instanceof Response) {
    fail('anonymous leave-review.html was blocked');
  }

  const anonApi = await run('http://127.0.0.1/api/email-review?token=abc');
  if (anonApi instanceof Response) {
    fail('email-review API was blocked (' + anonApi.status + ')');
  }

  const anonEvents = await run('http://127.0.0.1/events');
  if (!(anonEvents instanceof Response) || !locationOf(anonEvents).includes('/site-access')) {
    fail('public events catalogue should stay behind the site gate');
  }

  const signedReview = await run(
    'http://127.0.0.1/events/leave-review?token=abc',
    'hub_session=' + session
  );
  if (locationOf(signedReview).includes('/organiser')) {
    fail('signed-in review link redirected to the organiser workspace');
  }
  if (signedReview instanceof Response) {
    fail('signed-in review link was blocked (' + signedReview.status + ')');
  }

  const signedEvents = await run('http://127.0.0.1/events', 'hub_session=' + session);
  if (!locationOf(signedEvents).includes('/organiser/')) {
    fail('signed-in catalogue browse should still open the organiser workspace');
  }
}

const { pathToFileURL } = require('url');

assertReviewRoutes()
  .then(function () {
    console.log('test-leave-review-route: ok');
  })
  .catch(function (err) {
    fail(err && err.stack ? err.stack : String(err));
  });
