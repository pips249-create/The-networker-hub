#!/usr/bin/env node
/**
 * Reset Email 2 claim retest fixtures (Catherine / testing-group-email-2*).
 *
 * - Sets matching organiser pages back to ownership_claim_status = pending
 * - Clears owner linkage + founding flags so claim awards them again
 * - Optionally deletes the Hub auth user for a clean signup
 *
 * Usage:
 *   node scripts/reset-email2-claim-retest.js
 *   node scripts/reset-email2-claim-retest.js --execute
 *   node scripts/reset-email2-claim-retest.js --execute --delete-hub-user
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

const TEST_EMAIL = 'catherine@the-networker.co.uk';
const SLUG_PREFIX = 'testing-group-email-2';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
    deleteHubUser: args.includes('--delete-hub-user'),
  };
}

async function main() {
  const { execute, deleteHubUser } = parseArgs();
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const { data: bySlug, error: slugErr } = await sb
    .from('organisers')
    .select(
      'id, name, slug, email, contact_email, ownership_claim_status, supabase_user_id, founding_organiser_at, founding_homepage_until'
    )
    .ilike('slug', SLUG_PREFIX + '%');
  if (slugErr) throw new Error(slugErr.message);

  const { data: byEmail, error: emailErr } = await sb
    .from('organisers')
    .select(
      'id, name, slug, email, contact_email, ownership_claim_status, supabase_user_id, founding_organiser_at, founding_homepage_until'
    )
    .or('email.eq.' + TEST_EMAIL + ',contact_email.eq.' + TEST_EMAIL);
  if (emailErr) throw new Error(emailErr.message);

  const byId = new Map();
  (bySlug || []).concat(byEmail || []).forEach(function (row) {
    if (row && row.id) byId.set(row.id, row);
  });
  const rows = [...byId.values()];

  console.log('Email 2 claim retest reset' + (execute ? ' (EXECUTE)' : ' (dry run)'));
  console.log('Matched organiser pages:', rows.length);
  rows.forEach(function (r) {
    console.log(
      ' -',
      r.slug || r.id,
      '|',
      r.ownership_claim_status,
      '| founding:',
      Boolean(r.founding_organiser_at)
    );
  });

  if (!rows.length) {
    console.log('Nothing to reset.');
    return;
  }

  if (!execute) {
    console.log('\nRe-run with --execute to apply. Add --delete-hub-user to remove the Hub account.');
    return;
  }

  for (const row of rows) {
    const { error } = await sb
      .from('organisers')
      .update({
        ownership_claim_status: 'pending',
        supabase_user_id: null,
        ownership_claimed_at: null,
        founding_organiser_at: null,
        founding_homepage_until: null,
      })
      .eq('id', row.id);
    if (error) throw new Error(error.message);
    console.log('Reset organiser', row.slug || row.id);
  }

  if (deleteHubUser) {
    const { data: users, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const match = (users && users.users ? users.users : []).find(function (u) {
      return String(u.email || '').toLowerCase() === TEST_EMAIL;
    });
    if (!match) {
      console.log('No Hub auth user for', TEST_EMAIL);
    } else {
      const { error: delErr } = await sb.auth.admin.deleteUser(match.id);
      if (delErr) throw new Error(delErr.message);
      console.log('Deleted Hub auth user', match.id);

      try {
        await sb.from('hub_accounts').delete().eq('email', TEST_EMAIL);
      } catch (e) {
        /* optional table */
      }
      try {
        await sb.from('attendees').delete().ilike('email', TEST_EMAIL);
      } catch (e) {
        /* optional */
      }
    }
  }

  console.log('\nDone. Clear browser localStorage keys before retest:');
  console.log(
    '  hub_launch_setup_v1, hub_organiser_profile_review_v1, hub_claim_review_order_v1, hub_claim_focus_v1, hub_founding_toast, hub_organiser_tour_v3'
  );
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
