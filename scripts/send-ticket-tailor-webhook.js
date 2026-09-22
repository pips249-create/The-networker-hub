#!/usr/bin/env node
/**
 * Send a sample Ticket Tailor ORDER.CREATED webhook to TNH (pilot / QA).
 *
 *   node scripts/send-ticket-tailor-webhook.js \
 *     --url 'https://www.thenetworkeruk.com/w/tt/YOUR_TOKEN' \
 *     --event-id ev_40980 \
 *     --email buyer@example.com \
 *     --order-id or_test_123
 *
 * Requires: Ticket Tailor enabled on the organiser account, TNH event linked to --event-id.
 */
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

function postJson(urlStr, bodyObj) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj), 'utf8');
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
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

function sampleOrderCreatedPayload(opts) {
  const orderId = String(opts.order_id || 'or_test_' + Date.now());
  const eventId = String(opts.event_id || 'ev_40980');
  const email = String(opts.email || 'buyer@example.com');
  const name = String(opts.name || 'Test Buyer');
  const totalPaid = Number(opts.total_paid);
  const paid = Number.isFinite(totalPaid) ? totalPaid : 0;
  return {
    id: 'wh_test_' + Date.now(),
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    event: 'ORDER.CREATED',
    resource_url: 'https://api.tickettailor.com/v1/orders/' + orderId,
    payload: {
      object: 'order',
      id: orderId,
      status: opts.pending ? 'pending' : 'completed',
      buyer_details: {
        email,
        name,
        first_name: name.split(' ')[0] || name,
        last_name: name.split(' ').slice(1).join(' ') || name,
      },
      currency: { base_multiplier: 100, code: 'gbp' },
      total_paid: paid,
      total: paid,
      event_summary: {
        event_id: eventId,
        id: eventId,
        name: 'Test event',
      },
      line_items: [{ type: 'ticket', quantity: 1, total: paid, value: paid }],
      issued_tickets: [{ event_id: eventId, email, order_id: orderId }],
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const url =
    args.url ||
    process.env.TICKET_TAILOR_WEBHOOK_URL ||
    process.env.CONNECTED_BOOKING_PROVIDER_WEBHOOK_URL;
  if (!url) {
    console.error('Missing --url (Ticket Tailor webhook URL from Connected setup, includes token).');
    process.exit(1);
  }
  if (!args.event_id) {
    console.error('Missing --event-id (Ticket Tailor ev_… id linked on the TNH event).');
    process.exit(1);
  }

  const body = sampleOrderCreatedPayload(args);
  const res = await postJson(url, body);
  console.log('HTTP', res.status);
  try {
    console.log(JSON.stringify(JSON.parse(res.body), null, 2));
  } catch {
    console.log(res.body);
  }
  process.exit(res.status >= 200 && res.status < 300 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
