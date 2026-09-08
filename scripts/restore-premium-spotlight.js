#!/usr/bin/env node
/**
 * Restore Premium Spotlight placements on live events.
 *
 * Usage:
 *   node scripts/restore-premium-spotlight.js
 *   node scripts/restore-premium-spotlight.js --slug=the-business-show-london
 *   node scripts/restore-premium-spotlight.js --id=<uuid> --until=2026-11-12
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (local.env or process env).
 */
const path = require('path');
const fs = require('fs');

function loadLocalEnv() {
  const candidates = [
    path.join(process.cwd(), 'local.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') process.env[key] = val;
    }
  }
}

loadLocalEnv();

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { setEventFeaturedPlacement } = require('../api/_lib/event-featured');
const { parseAdminFeaturedUntil } = require('../api/_lib/admin-featured-until');

const DEFAULT_SLUGS = ['the-business-show-london'];

function parseArgs(argv) {
  const out = { slugs: [], ids: [], until: null };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--slug=')) out.slugs.push(arg.slice('--slug='.length).trim());
    else if (arg.startsWith('--id=')) out.ids.push(arg.slice('--id='.length).trim());
    else if (arg.startsWith('--until=')) out.until = arg.slice('--until='.length).trim() || null;
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  if (!out.slugs.length && !out.ids.length) out.slugs = DEFAULT_SLUGS.slice();
  return out;
}

async function resolveEventId(sb, { id, slug }) {
  if (id) {
    const { data, error } = await sb
      .from('events')
      .select('id, title, slug, starts_at, featured, featured_until, status, approval_status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await sb
    .from('events')
    .select('id, title, slug, starts_at, featured, featured_until, status, approval_status')
    .eq('slug', slug)
    .order('starts_at', { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);
  const rows = data || [];
  if (!rows.length) return null;
  const upcoming = rows.find((row) => row.starts_at && new Date(row.starts_at) > new Date());
  return upcoming || rows[0];
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Restore Premium Spotlight for one or more events.

Defaults to: ${DEFAULT_SLUGS.join(', ')}

Examples:
  node scripts/restore-premium-spotlight.js
  node scripts/restore-premium-spotlight.js --slug=the-business-show-london --until=2026-11-12
`);
    return;
  }

  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (local.env or env).');
    process.exit(1);
  }

  const featuredUntil = args.until != null ? parseAdminFeaturedUntil(args.until) : null;
  const sb = getSupabaseAdmin();
  const targets = [
    ...args.ids.map((id) => ({ id })),
    ...args.slugs.map((slug) => ({ slug })),
  ];

  let restored = 0;
  for (const target of targets) {
    const row = await resolveEventId(sb, target);
    if (!row) {
      console.error('Not found:', target.id || target.slug);
      process.exitCode = 1;
      continue;
    }
    console.log(
      `Featuring: ${row.title} (${row.slug}) starts=${row.starts_at} was featured=${row.featured}`
    );
    const result = await setEventFeaturedPlacement(row.id, { featured_until: featuredUntil });
    console.log(
      `  → featured on ${result.seriesEventIds.length} series row(s); until=${
        result.event.featured_until || 'none'
      }`
    );
    restored += 1;
  }

  console.log(`Done. Restored ${restored} listing(s). Check /events/ Premium Spotlight.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
