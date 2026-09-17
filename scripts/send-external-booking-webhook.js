#!/usr/bin/env node
/**
 * Send a signed test registration to POST /api/integrations/booking
 * (simulates what your site or Zapier should send after an Eventbrite order).
 *
 * Usage (from repo root):
 *   node scripts/send-external-booking-webhook.js \
 *     --url https://www.thenetworkeruk.com/api/integrations/booking \
 *     --account-id YOUR_ORGANISER_ACCOUNT_UUID \
 *     --event-id YOUR_TNH_EVENT_UUID \
 *     --secret YOUR_WEBHOOK_SECRET_HEX \
 *     --order-id eventbrite-12345 \
 *     --email buyer@example.com \
 *     --name "Alex Smith"
 */
const crypto = require('crypto');
const https = require('https');
const http = require('http');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2).replace(/-/g, '_');
    const val = argv[i + 1];
    if (val && !val.startsWith('--')) {
      out[key] = val;
      i++;
    }
  }
  return out;
}

function sign(secret, raw) {
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

function postJson(urlStr, headers, bodyBuf) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyBuf.length,
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data });
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const url =
    args.url || process.env.CONNECTED_BOOKING_WEBHOOK_URL || 'http://localhost:3000/api/integrations/booking';
  const accountId = args.account_id || process.env.ORGANISER_ACCOUNT_ID;
  const eventId = args.event_id || process.env.TNH_EVENT_ID;
  const secret = args.secret || process.env.CONNECTED_BOOKING_WEBHOOK_SECRET;
  const orderId = args.order_id || 'test-order-' + Date.now();
  const email = args.email || 'test@example.com';
  const name = args.name || 'Test User';

  if (!accountId || !eventId || !secret) {
    console.error(
      'Missing --account-id, --event-id, or --secret (or env ORGANISER_ACCOUNT_ID, TNH_EVENT_ID, CONNECTED_BOOKING_WEBHOOK_SECRET)'
    );
    process.exit(1);
  }

  const payload = {
    eventId,
    orderId,
    email,
    name,
    quantity: 1,
    amountPaid: 0,
    status: 'confirmed',
  };
  const bodyBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = sign(secret, bodyBuf);

  const res = await postJson(url, {
    'X-Organiser-Account-Id': accountId,
    'X-Networker-Signature': signature,
  }, bodyBuf);

  console.log('HTTP', res.status);
  console.log(res.body);
  process.exit(res.status >= 200 && res.status < 300 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
