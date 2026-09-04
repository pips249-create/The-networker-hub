#!/usr/bin/env node
/**
 * Live smoke test for Stripe webhook reachability (no signing secret required).
 *
 *   node scripts/smoke-test-stripe-webhook.js
 *   node scripts/smoke-test-stripe-webhook.js https://www.thenetworkeruk.com
 *
 * Expects:
 *   - Canonical host returns 400 invalid_signature (handler reachable, auth required)
 *   - Apex host serves the handler directly (no 308) so Stripe can deliver if misconfigured on apex
 *   - vercel.app alias still 308-redirects — Stripe Dashboard must NOT use that URL
 */
const baseArg = (process.argv[2] || 'https://www.thenetworkeruk.com').replace(/\/$/, '');

async function probe(url, opts = {}) {
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
      ...(opts.headers || {}),
    },
    body: opts.body || JSON.stringify({ id: 'evt_smoke', object: 'event', type: 'ping' }),
  });
  const text = await res.text();
  const location = res.headers.get('location') || '';
  return { status: res.status, text: text.slice(0, 200), location };
}

function fail(msg) {
  console.error('FAIL', msg);
  process.exitCode = 1;
}

(async function main() {
  console.log('Checking Stripe webhook endpoints…');

  const www = await probe(baseArg + '/api/stripe-webhook');
  console.log('  www  ', www.status, www.text || www.location);
  if (www.status !== 400 || !/invalid_signature/.test(www.text)) {
    fail(`Expected 400 invalid_signature on ${baseArg}/api/stripe-webhook, got ${www.status} ${www.text}`);
  } else {
    console.log('  OK   canonical webhook handler reachable');
  }

  const apexHost = baseArg.replace('://www.', '://');
  if (apexHost !== baseArg) {
    const apex = await probe(apexHost + '/api/stripe-webhook');
    console.log('  apex ', apex.status, apex.text || apex.location);
    if (apex.status >= 300 && apex.status < 400) {
      console.log(
        '  WARN apex webhook redirects (' +
          apex.status +
          ' → ' +
          apex.location +
          '). Stripe Dashboard must use the www URL; apex redirects are OK for HTML only.'
      );
    } else if (apex.status === 400 && /invalid_signature/.test(apex.text)) {
      console.log('  OK   apex webhook reaches handler (no redirect)');
    } else {
      console.log('  WARN apex returned', apex.status, apex.text || apex.location);
    }
  }

  const vercelAlias = await probe('https://the-networker-hub.vercel.app/api/stripe-webhook');
  console.log('  alias', vercelAlias.status, vercelAlias.text || vercelAlias.location);
  if (vercelAlias.status >= 300 && vercelAlias.status < 400) {
    console.log('  OK   vercel.app still redirects — Stripe Dashboard must use www.thenetworkeruk.com');
  } else {
    console.log('  NOTE vercel.app did not redirect (status', vercelAlias.status + ')');
  }

  if (process.exitCode) {
    console.error('\nStripe webhook smoke test failed.');
    process.exit(process.exitCode);
  }
  console.log('\nStripe webhook smoke test passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
