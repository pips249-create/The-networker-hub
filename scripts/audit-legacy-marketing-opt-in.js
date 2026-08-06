#!/usr/bin/env node
/**
 * Report hub accounts with marketing enabled (for legacy re-permission campaign).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (local.env or shell).
 *
 * Run: node scripts/audit-legacy-marketing-opt-in.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
const { createClient } = require('@supabase/supabase-js');

const url = String(process.env.SUPABASE_URL || '').trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see local.env).');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const LEGACY_CUTOFF = '2026-07-01T00:00:00.000Z';

async function main() {
  // hub_accounts has no email / marketing_opt_in columns — use emails_enabled + Auth emails.
  const { data, error } = await sb
    .from('hub_accounts')
    .select('user_id, display_name, emails_enabled, created_at')
    .eq('emails_enabled', true)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const authById = new Map();
  let page = 1;
  const perPage = 1000;
  while (page <= 50) {
    const { data: list, error: authErr } = await sb.auth.admin.listUsers({ page, perPage });
    if (authErr) {
      console.error('auth.admin.listUsers failed:', authErr.message);
      process.exit(1);
    }
    (list.users || []).forEach((u) => authById.set(u.id, u));
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }

  const rows = (data || []).map((r) => {
    const u = authById.get(r.user_id);
    return {
      email: String((u && u.email) || '').trim().toLowerCase(),
      name: r.display_name || '',
      created_at: r.created_at || '',
    };
  }).filter((r) => r.email);

  const legacy = rows.filter((r) => String(r.created_at || '') < LEGACY_CUTOFF);
  const recent = rows.length - legacy.length;

  console.log('Marketing / emails_enabled audit');
  console.log('  Total emails_enabled:', rows.length);
  console.log('  Created before July 2026 (legacy):', legacy.length);
  console.log('  Created July 2026+:', recent);
  console.log('\nLegacy accounts to consider for re-permission email:');
  legacy.slice(0, 25).forEach((r) => {
    console.log('  -', r.email, '(' + (r.created_at || '').slice(0, 10) + ')');
  });
  if (legacy.length > 25) console.log('  … and', legacy.length - 25, 'more');

  console.log('\nNext: send one-off re-permission before bulk marketing (see docs/COMPLIANCE-RUNBOOK.md).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
