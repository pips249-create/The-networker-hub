#!/usr/bin/env node
/**
 * Push STRIPE_* vars from local.env to Vercel (production + preview).
 * Edit local.env first, then: node scripts/push-stripe-to-vercel.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const local = dotenv.parse(fs.readFileSync(path.join(root, 'local.env'), 'utf8'));

const KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_ENABLED'];
const TARGETS = ['production', 'preview'];

function assertReady() {
  for (const key of KEYS) {
    const val = String(local[key] || '').trim();
    if (!val || /PASTE_YOUR/i.test(val)) {
      console.error(`\nMissing ${key} in local.env — paste your live key from Stripe Dashboard first.\n`);
      process.exit(1);
    }
    if (key === 'STRIPE_SECRET_KEY' && !val.startsWith('sk_live_') && !val.startsWith('sk_test_')) {
      console.error(`\n${key} should start with sk_live_ or sk_test_\n`);
      process.exit(1);
    }
    if (key === 'STRIPE_WEBHOOK_SECRET' && !val.startsWith('whsec_')) {
      console.error(`\n${key} should start with whsec_\n`);
      process.exit(1);
    }
  }
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env });
}

function setEnv(name, value, target) {
  try {
    run(`npx vercel env rm ${name} ${target} --yes`);
  } catch {
    /* not set yet */
  }
  run(`printf %s ${JSON.stringify(value)} | npx vercel env add ${name} ${target}`);
}

assertReady();

console.log('Pushing Stripe env vars to Vercel…\n');
for (const target of TARGETS) {
  for (const key of KEYS) {
    console.log(`  ${key} → ${target}`);
    setEnv(key, String(local[key]).trim(), target);
  }
}

console.log('\nDone. Run: npm run deploy\n');
