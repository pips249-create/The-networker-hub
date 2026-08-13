#!/usr/bin/env node
/**
 * Reset soft-created "claimed" pages that never signed in.
 *
 * These were incorrectly marked claimed (hub account provisioned) and then
 * received founding badges via backfill — they never completed the personalised
 * claim URL flow. Reset to pending and clear founding flags so Email 2 still works.
 *
 * Keeps: supabase_user_id, organiser_account_id
 * Clears: ownership_claim_status → pending, ownership_claimed_at, founding_*
 *
 * Usage:
 *   node scripts/reset-unsigned-false-claims.js
 *   node scripts/reset-unsigned-false-claims.js --execute
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
const { FOUNDING_HOMEPAGE_UNTIL, FOUNDING_HOMEPAGE_CAP } = require('../api/_lib/founding-organiser');

const EXECUTE = process.argv.includes('--execute');

async function lastSignInByUserId(sb, userIds) {
  const map = {};
  for (const uid of userIds) {
    if (!uid) continue;
    try {
      const { data, error } = await sb.auth.admin.getUserById(uid);
      if (error || !data || !data.user) {
        map[uid] = null;
        continue;
      }
      map[uid] = data.user.last_sign_in_at || null;
    } catch {
      map[uid] = null;
    }
  }
  return map;
}

(async () => {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const { data: orgs, error } = await sb
    .from('organisers')
    .select(
      'id, name, slug, email, contact_email, ownership_claim_status, ownership_claimed_at, founding_organiser_at, founding_homepage_until, is_internal, supabase_user_id'
    )
    .eq('ownership_claim_status', 'claimed');
  if (error) throw error;

  const rows = orgs || [];
  const userIds = [...new Set(rows.map((r) => r.supabase_user_id).filter(Boolean))];
  const signIns = await lastSignInByUserId(sb, userIds);

  const falseClaims = rows.filter((r) => {
    if (!r.supabase_user_id) return true;
    return !signIns[r.supabase_user_id];
  });
  const realClaims = rows.filter((r) => r.supabase_user_id && signIns[r.supabase_user_id]);

  console.log(EXECUTE ? 'EXECUTE' : 'DRY RUN');
  console.log('Claimed pages:', rows.length);
  console.log('Never signed in (reset targets):', falseClaims.length);
  console.log('Have signed in (keep):', realClaims.length);
  console.log(
    'Keep sample:',
    realClaims.slice(0, 12).map((r) => r.name + (r.is_internal ? ' [internal]' : ''))
  );
  console.log(
    'Reset sample:',
    falseClaims.slice(0, 12).map((r) => r.name)
  );

  if (!EXECUTE) {
    console.log('Re-run with --execute to apply.');
    return;
  }

  const ids = falseClaims.map((r) => r.id);
  let reset = 0;
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const { data, error: upErr } = await sb
      .from('organisers')
      .update({
        ownership_claim_status: 'pending',
        ownership_claimed_at: null,
        founding_organiser_at: null,
        founding_homepage_until: null,
      })
      .in('id', chunk)
      .eq('ownership_claim_status', 'claimed')
      .select('id');
    if (upErr) throw upErr;
    reset += (data || []).length;
  }
  console.log('Reset to pending:', reset);

  // Re-fill homepage slots for remaining real founding (first N by claim time).
  const stillFounding = realClaims
    .filter((r) => r.founding_organiser_at && !r.is_internal)
    .sort((a, b) => String(a.ownership_claimed_at || '').localeCompare(String(b.ownership_claimed_at || '')));

  // Clear homepage on anyone not in the new top N
  const { error: clearErr } = await sb
    .from('organisers')
    .update({ founding_homepage_until: null })
    .not('founding_homepage_until', 'is', null);
  if (clearErr) throw clearErr;

  const top = stillFounding.slice(0, FOUNDING_HOMEPAGE_CAP);
  if (top.length) {
    const { error: slotErr } = await sb
      .from('organisers')
      .update({ founding_homepage_until: FOUNDING_HOMEPAGE_UNTIL.toISOString() })
      .in(
        'id',
        top.map((r) => r.id)
      );
    if (slotErr) throw slotErr;
  }
  console.log('Homepage slots reassigned:', top.length, '(cap', FOUNDING_HOMEPAGE_CAP + ')');
  console.log(
    'Homepage names:',
    top.map((r) => r.name)
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
