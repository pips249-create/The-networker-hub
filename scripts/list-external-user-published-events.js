#!/usr/bin/env node
/**
 * List published upcoming events created by non-staff / non-admin users.
 * Command Centre report: Analytics → User events (#analytics/user-events).
 *
 * Run: node scripts/list-external-user-published-events.js
 *      node scripts/list-external-user-published-events.js --all-published
 *      node scripts/list-external-user-published-events.js --json
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { listExternalUserPublishedEvents } = require('../api/_lib/external-user-published-events');

function parseArgs(argv) {
  return {
    allPublished: argv.includes('--all-published'),
    json: argv.includes('--json'),
    limit: (() => {
      const hit = argv.find((a) => a.startsWith('--limit='));
      return hit ? Math.max(1, parseInt(hit.split('=')[1], 10) || 200) : 200;
    })(),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const report = await listExternalUserPublishedEvents(sb, {
    upcomingOnly: !opts.allPublished,
    limit: opts.limit,
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('External user-published events');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('');
  report.events.slice(0, opts.limit).forEach((row) => {
    console.log(
      [
        row.startsAt ? row.startsAt.slice(0, 10) : 'TBC',
        row.title,
        row.organiser ? `(${row.organiser})` : '',
        row.slug ? `/events/${row.slug}` : '',
        row.publishActorEmail ? `by ${row.publishActorEmail}` : row.ownerEmail ? `owner ${row.ownerEmail}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
    );
  });
  if (report.events.length > opts.limit) {
    console.log(`\n… and ${report.events.length - opts.limit} more (use --limit=N or --json)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
