#!/usr/bin/env node
/**
 * Report hub accounts with marketing enabled (for legacy re-permission campaign).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (local.env or shell).
 *
 * Accounts created before MARKETING_OPT_IN_FIXED_AT may have had a pre-ticked
 * marketing checkbox at registration — treat as needing re-permission before
 * bulk marketing (see docs/COMPLIANCE-RUNBOOK.md).
 *
 * Run: node scripts/audit-legacy-marketing-opt-in.js
 * CSV:  data/legacy-marketing-opt-in-audit.csv  (gitignored — contains emails)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = String(process.env.SUPABASE_URL || '').trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see local.env).');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
/** Date the register marketing checkbox was made unchecked-by-default. */
const MARKETING_OPT_IN_FIXED_AT = '2026-08-25T00:00:00.000Z';
const OUT_CSV = path.join(__dirname, '..', 'data', 'legacy-marketing-opt-in-audit.csv');

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function main() {
  // hub_accounts has no email column — use emails_enabled + Auth emails.
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

  const rows = (data || [])
    .map((r) => {
      const u = authById.get(r.user_id);
      return {
        email: String((u && u.email) || '')
          .trim()
          .toLowerCase(),
        name: r.display_name || '',
        user_id: r.user_id || '',
        created_at: r.created_at || '',
      };
    })
    .filter((r) => r.email);

  const legacy = rows.filter((r) => String(r.created_at || '') < MARKETING_OPT_IN_FIXED_AT);
  const recent = rows.length - legacy.length;

  console.log('Marketing / emails_enabled audit');
  console.log('  Cutoff (pre-ticked checkbox fixed):', MARKETING_OPT_IN_FIXED_AT.slice(0, 10));
  console.log('  Total emails_enabled:', rows.length);
  console.log('  Created before cutoff (re-permission candidates):', legacy.length);
  console.log('  Created on/after cutoff (valid opt-in assumed):', recent);
  console.log('\nSample legacy accounts:');
  legacy.slice(0, 25).forEach((r) => {
    console.log('  -', r.email, '(' + (r.created_at || '').slice(0, 10) + ')');
  });
  if (legacy.length > 25) console.log('  … and', legacy.length - 25, 'more');

  const header = 'email,name,user_id,created_at,needs_repermission';
  const lines = [header].concat(
    rows.map((r) =>
      [
        csvEscape(r.email),
        csvEscape(r.name),
        csvEscape(r.user_id),
        csvEscape(r.created_at),
        String(r.created_at || '') < MARKETING_OPT_IN_FIXED_AT ? 'yes' : 'no',
      ].join(',')
    )
  );
  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  fs.writeFileSync(OUT_CSV, lines.join('\n') + '\n', 'utf8');
  console.log('\nWrote', OUT_CSV);
  console.log('Next: send re-permission email (docs/MARKETING-REPERMISSION.md) before bulk marketing.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
