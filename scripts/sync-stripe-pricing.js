#!/usr/bin/env node
/**
 * Create or update Stripe Products, Prices, and Payment Links for hub advertising.
 *
 * Usage:
 *   npm run sync-stripe
 *   npm run sync-stripe -- --write-local   # append/update keys in local.env
 *   npm run sync-stripe -- --dry-run       # print planned env vars without Stripe calls
 *
 * Requires STRIPE_SECRET_KEY in local.env (sk_test_… for sandbox, sk_live_… for production).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Stripe = require('stripe');
const { HUB_STRIPE_CATALOG, formatGbp } = require('../api/_lib/hub-stripe-catalog');
const { syncHubStripeCatalog, buildEnvUpdates } = require('../api/_lib/stripe-catalog-sync');

const root = path.join(__dirname, '..');
const localEnvPath = path.join(root, 'local.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}
dotenv.config({ path: path.join(root, '.env') });

const args = process.argv.slice(2);
const writeLocal = args.includes('--write-local');
const dryRun = args.includes('--dry-run');

function mergeLocalEnv(updates) {
  const existing = fs.existsSync(localEnvPath)
    ? dotenv.parse(fs.readFileSync(localEnvPath, 'utf8'))
    : {};
  const merged = { ...existing, ...updates };
  const lines = Object.entries(merged).map(([key, value]) => key + '=' + value);
  fs.writeFileSync(localEnvPath, lines.join('\n') + '\n', 'utf8');
}

async function main() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key && !dryRun) {
    console.error('Set STRIPE_SECRET_KEY in local.env (sk_test_… or sk_live_…).');
    process.exit(1);
  }

  const mode = key.startsWith('sk_live_') ? 'LIVE' : key.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN';
  console.log('platform Stripe catalog — ' + HUB_STRIPE_CATALOG.length + ' items');
  if (!dryRun) {
    console.log('Stripe mode: ' + mode);
  }

  HUB_STRIPE_CATALOG.forEach((item) => {
    const billing =
      item.billing === 'recurring' ? formatGbp(item.amountPence) + '/month' : formatGbp(item.amountPence);
    console.log('  • ' + item.key + ' — ' + billing + (item.createPaymentLink ? ' + payment link' : ''));
  });
  console.log('');

  if (dryRun) {
    console.log('Dry run — no Stripe API calls. Re-run without --dry-run after setting STRIPE_SECRET_KEY.');
    return;
  }

  const stripe = new Stripe(key);
  const results = await syncHubStripeCatalog(stripe);
  const envUpdates = buildEnvUpdates(results);

  for (const row of results) {
    const tags = [];
    if (row.productCreated) tags.push('new product');
    if (row.priceCreated) tags.push('new price');
    if (row.paymentLinkCreated) tags.push(row.paymentLinkReplaced ? 'new payment link (replaced old)' : 'new payment link');
    console.log(
      row.key +
        '\n  product: ' +
        row.productId +
        '\n  price:   ' +
        row.priceId +
        ' → ' +
        row.priceEnvVar +
        (row.paymentLinkUrl
          ? '\n  link:    ' + row.paymentLinkUrl + '\n           → ' + row.paymentLinkEnvVar
          : '') +
        (tags.length ? '\n  (' + tags.join(', ') + ')' : '')
    );
    console.log('');
  }

  console.log('# Copy to Vercel → Environment Variables:\n');
  Object.entries(envUpdates).forEach(([envKey, value]) => {
    console.log(envKey + '=' + value);
  });
  console.log('');

  if (writeLocal) {
    mergeLocalEnv(envUpdates);
    console.log('Updated ' + localEnvPath + ' — run npm run sync-env then redeploy.');
  } else {
    console.log('Tip: npm run sync-stripe -- --write-local to save price/link IDs into local.env');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
