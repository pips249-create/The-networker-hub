#!/usr/bin/env node
/**
 * Merge one Hub login into another (surviving account keeps its email/login).
 *
 * Usage (dry-run by default):
 *   node scripts/merge-hub-accounts.js from@example.com into@example.com
 * Apply:
 *   node scripts/merge-hub-accounts.js from@example.com into@example.com --apply
 *
 * Moves attendee-owned rows, organiser ownership, opportunity ownership, and
 * email-keyed access onto the surviving account, then deletes the source auth user.
 *
 * Reads local.env or .env for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { findUserByEmail } = require('../api/_lib/supabase-auth');

const FROM_EMAIL = String(process.argv[2] || '')
  .trim()
  .toLowerCase();
const INTO_EMAIL = String(process.argv[3] || '')
  .trim()
  .toLowerCase();
const APPLY = process.argv.includes('--apply');

function log(step, detail) {
  console.log(APPLY ? `[apply] ${step}` : `[dry-run] ${step}`, detail || '');
}

async function getAttendee(sb, email, userId) {
  let byEmail = await sb.from('attendees').select('*').eq('email', email).maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  if (byEmail.data) return byEmail.data;

  if (userId) {
    const byUser = await sb.from('attendees').select('*').eq('supabase_user_id', userId).maybeSingle();
    if (byUser.error) throw new Error(byUser.error.message);
    if (byUser.data) return byUser.data;
  }
  return null;
}

async function ensureIntoAttendee(sb, intoUser, intoAttendee) {
  if (intoAttendee) {
    if (!intoAttendee.supabase_user_id && intoUser.id) {
      if (APPLY) {
        const { error } = await sb
          .from('attendees')
          .update({ supabase_user_id: intoUser.id })
          .eq('id', intoAttendee.id);
        if (error) throw new Error(error.message);
      }
      log('link attendee.supabase_user_id', intoAttendee.id + ' → ' + intoUser.id);
    }
    return intoAttendee;
  }

  const row = {
    email: INTO_EMAIL,
    supabase_user_id: intoUser.id,
    name: intoUser.name || null,
  };
  if (!APPLY) {
    log('would create attendees row', JSON.stringify(row));
    return { id: null, ...row };
  }
  const { data, error } = await sb.from('attendees').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  log('created attendees row', data.id);
  return data;
}

async function moveUniqueRows(sb, table, fromAid, intoAid, uniqueCols, label) {
  const { data: rows, error } = await sb.from(table).select('*').eq('attendee_id', fromAid);
  if (error) throw new Error(`${table}: ${error.message}`);
  if (!rows || !rows.length) {
    log(`${label}: none`, table);
    return { moved: 0, dropped: 0 };
  }

  let moved = 0;
  let dropped = 0;
  for (const row of rows) {
    const filters = {};
    let conflict = false;
    for (const col of uniqueCols) {
      filters[col] = row[col];
    }
    if (intoAid) {
      let q = sb.from(table).select('id').eq('attendee_id', intoAid);
      for (const col of uniqueCols) {
        q = q.eq(col, row[col]);
      }
      const existing = await q.maybeSingle();
      if (existing.error) throw new Error(`${table} conflict check: ${existing.error.message}`);
      conflict = !!existing.data;
    }

    if (conflict) {
      if (APPLY) {
        const { error: delErr } = await sb.from(table).delete().eq('id', row.id);
        if (delErr) throw new Error(`${table} drop dup: ${delErr.message}`);
      }
      dropped += 1;
      log(`${label}: drop duplicate`, `${table} ${row.id}`);
      continue;
    }

    if (APPLY) {
      const { error: updErr } = await sb.from(table).update({ attendee_id: intoAid }).eq('id', row.id);
      if (updErr) throw new Error(`${table} move: ${updErr.message}`);
    }
    moved += 1;
    log(`${label}: move`, `${table} ${row.id}`);
  }
  return { moved, dropped };
}

async function reassignAttendeeId(sb, table, fromAid, intoAid, label) {
  const { data: rows, error } = await sb.from(table).select('id').eq('attendee_id', fromAid);
  if (error) {
    // Table may not exist in older envs
    if (/does not exist|42P01/i.test(error.message || '')) {
      log(`${label}: skip missing table`, table);
      return 0;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  if (!rows || !rows.length) {
    log(`${label}: none`, table);
    return 0;
  }
  if (APPLY) {
    const { error: updErr } = await sb.from(table).update({ attendee_id: intoAid }).eq('attendee_id', fromAid);
    if (updErr) throw new Error(`${table} reassign: ${updErr.message}`);
  }
  log(`${label}: reassign ${rows.length}`, table);
  return rows.length;
}

async function mergeOrganiserAccounts(sb, fromUid, intoUid, fromEmail, intoEmail) {
  const { data: fromRows, error: e1 } = await sb
    .from('organiser_accounts')
    .select('*')
    .or(`email.eq.${fromEmail},supabase_user_id.eq.${fromUid}`);
  if (e1) throw new Error('organiser_accounts source: ' + e1.message);

  const { data: intoRows, error: e2 } = await sb
    .from('organiser_accounts')
    .select('*')
    .or(`email.eq.${intoEmail},supabase_user_id.eq.${intoUid}`);
  if (e2) throw new Error('organiser_accounts surviving: ' + e2.message);

  const intoExisting = (intoRows || [])[0] || null;
  const fromList = fromRows || [];

  for (const row of fromList) {
    if (intoExisting && intoExisting.id !== row.id) {
      // Prefer surviving row; copy Stripe from source if survivor has none
      if (intoExisting && !intoExisting.stripe_account_id && row.stripe_account_id) {
        if (APPLY) {
          const { error } = await sb
            .from('organiser_accounts')
            .update({
              stripe_account_id: row.stripe_account_id,
              stripe_onboarded: row.stripe_onboarded === true,
            })
            .eq('id', intoExisting.id);
          if (error) throw new Error('organiser_accounts stripe copy: ' + error.message);
        }
        log('organiser_accounts: copy Stripe onto Paul', row.stripe_account_id);
      }
      if (APPLY) {
        const { error } = await sb.from('organiser_accounts').delete().eq('id', row.id);
        if (error) throw new Error('organiser_accounts drop source: ' + error.message);
      }
      log('organiser_accounts: drop Phil duplicate', row.id);
      continue;
    }

    if (APPLY) {
      const { error } = await sb
        .from('organiser_accounts')
        .update({ email: intoEmail, supabase_user_id: intoUid })
        .eq('id', row.id);
      if (error) throw new Error('organiser_accounts reassign: ' + error.message);
    }
    log('organiser_accounts: reassign to Paul', row.id);
  }
}

async function reassignUserId(sb, table, column, fromUid, intoUid, label) {
  const { data: rows, error } = await sb.from(table).select('id').eq(column, fromUid);
  if (error) {
    if (/does not exist|42P01|column/i.test(error.message || '')) {
      log(`${label}: skip`, table + '.' + column + ' — ' + error.message);
      return 0;
    }
    throw new Error(`${table}.${column}: ${error.message}`);
  }
  if (!rows || !rows.length) {
    log(`${label}: none`, table);
    return 0;
  }
  if (APPLY) {
    const { error: updErr } = await sb.from(table).update({ [column]: intoUid }).eq(column, fromUid);
    if (updErr) throw new Error(`${table} reassign user: ${updErr.message}`);
  }
  log(`${label}: reassign ${rows.length}`, `${table}.${column}`);
  return rows.length;
}

async function reassignEmail(sb, table, column, fromEmail, intoEmail, label) {
  const { data: rows, error } = await sb.from(table).select('id').eq(column, fromEmail);
  if (error) {
    if (/does not exist|42P01|column/i.test(error.message || '')) {
      log(`${label}: skip`, table + '.' + column);
      return 0;
    }
    throw new Error(`${table}.${column}: ${error.message}`);
  }
  if (!rows || !rows.length) {
    log(`${label}: none`, `${table}.${column}`);
    return 0;
  }
  if (APPLY) {
    const { error: updErr } = await sb.from(table).update({ [column]: intoEmail }).eq(column, fromEmail);
    if (updErr) {
      // Unique conflicts: leave source email but log
      log(`${label}: email update failed (leaving as-is)`, updErr.message);
      return 0;
    }
  }
  log(`${label}: update email ${rows.length}`, `${table}.${column}`);
  return rows.length;
}

async function mergeOrganiserOwnership(sb, fromUid, intoUid, fromEmail, intoEmail) {
  const { data: byUser, error: e1 } = await sb
    .from('organisers')
    .select('id, name, email, contact_email, supabase_user_id')
    .eq('supabase_user_id', fromUid);
  if (e1) throw new Error(e1.message);

  const { data: byEmail, error: e2 } = await sb
    .from('organisers')
    .select('id, name, email, contact_email, supabase_user_id')
    .or(`email.eq.${fromEmail},contact_email.eq.${fromEmail}`);
  if (e2) throw new Error(e2.message);

  const map = new Map();
  (byUser || []).concat(byEmail || []).forEach((row) => map.set(row.id, row));
  const rows = Array.from(map.values());
  if (!rows.length) {
    log('organisers: none');
    return;
  }

  for (const row of rows) {
    const patch = { supabase_user_id: intoUid };
    // Keep Phil's address discoverable as contact if Paul's email is already primary
    if (String(row.email || '').toLowerCase() === fromEmail) {
      patch.email = intoEmail;
      if (!row.contact_email || String(row.contact_email).toLowerCase() === fromEmail) {
        patch.contact_email = fromEmail;
      }
    } else if (String(row.contact_email || '').toLowerCase() === fromEmail) {
      // leave contact_email as Phil so inbound mail still matches if needed
    }
    if (APPLY) {
      const { error } = await sb.from('organisers').update(patch).eq('id', row.id);
      if (error) throw new Error('organisers: ' + error.message);
    }
    log('organisers: claim for Paul', `${row.name || row.id} ${JSON.stringify(patch)}`);
  }
}

async function main() {
  if (!FROM_EMAIL || !INTO_EMAIL || FROM_EMAIL === INTO_EMAIL) {
    console.error(
      'Usage: node scripts/merge-hub-accounts.js from@example.com into@example.com [--apply]'
    );
    process.exit(1);
  }
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const fromUser = await findUserByEmail(FROM_EMAIL);
  const intoUser = await findUserByEmail(INTO_EMAIL);

  if (!intoUser) {
    console.error(`Surviving login not found: ${INTO_EMAIL}`);
    process.exit(1);
  }
  if (!fromUser) {
    console.error(`Source login not found: ${FROM_EMAIL}`);
    process.exit(1);
  }

  console.log('');
  console.log(`Merge ${FROM_EMAIL} (${fromUser.id})`);
  console.log(`  into ${INTO_EMAIL} (${intoUser.id})`);
  console.log(APPLY ? 'Mode: APPLY (writes enabled)' : 'Mode: DRY-RUN (pass --apply to write)');
  console.log('');

  let fromAttendee = await getAttendee(sb, FROM_EMAIL, fromUser.id);
  let intoAttendee = await getAttendee(sb, INTO_EMAIL, intoUser.id);
  intoAttendee = await ensureIntoAttendee(sb, intoUser, intoAttendee);

  if (!intoAttendee || !intoAttendee.id) {
    if (!APPLY) {
      log('dry-run needs apply to create missing Paul attendee before moves');
    } else {
      throw new Error('Could not ensure surviving attendee row');
    }
  }

  const fromAid = fromAttendee && fromAttendee.id;
  const intoAid = intoAttendee && intoAttendee.id;

  log('source attendee', fromAid || '(none)');
  log('surviving attendee', intoAid || '(none)');

  if (fromAid && intoAid) {
    await moveUniqueRows(sb, 'event_favourites', fromAid, intoAid, ['event_id'], 'event favourites');
    await moveUniqueRows(
      sb,
      'organiser_favourites',
      fromAid,
      intoAid,
      ['organiser_id'],
      'organiser favourites'
    );
    await moveUniqueRows(
      sb,
      'opportunity_favourites',
      fromAid,
      intoAid,
      ['opportunity_id'],
      'opportunity favourites'
    );
    await moveUniqueRows(sb, 'reviews', fromAid, intoAid, ['event_id'], 'reviews');
    await reassignAttendeeId(sb, 'registrations', fromAid, intoAid, 'registrations');
    await reassignAttendeeId(sb, 'opportunity_saved_searches', fromAid, intoAid, 'opp saved searches');
    await reassignAttendeeId(sb, 'organiser_member_roster', fromAid, intoAid, 'member roster');
    await reassignAttendeeId(sb, 'alumni_invites', fromAid, intoAid, 'alumni invites');
  } else if (fromAid && !intoAid) {
    log('skip attendee moves — surviving attendee id missing (dry-run without create)');
  } else {
    log('no source attendee row — skipping attendee-owned moves');
  }

  await mergeOrganiserOwnership(sb, fromUser.id, intoUser.id, FROM_EMAIL, INTO_EMAIL);
  await mergeOrganiserAccounts(sb, fromUser.id, intoUser.id, FROM_EMAIL, INTO_EMAIL);

  await reassignUserId(
    sb,
    'organiser_team_members',
    'supabase_user_id',
    fromUser.id,
    intoUser.id,
    'team members'
  );
  await reassignEmail(sb, 'organiser_team_members', 'email', FROM_EMAIL, INTO_EMAIL, 'team members email');

  await reassignUserId(
    sb,
    'business_opportunities',
    'supabase_user_id',
    fromUser.id,
    intoUser.id,
    'opportunities user'
  );
  await reassignEmail(sb, 'business_opportunities', 'owner_email', FROM_EMAIL, INTO_EMAIL, 'opportunities owner');
  await reassignEmail(
    sb,
    'opportunity_enquiries',
    'enquirer_email',
    FROM_EMAIL,
    INTO_EMAIL,
    'enquiries enquirer'
  );
  await reassignEmail(sb, 'opportunity_enquiries', 'owner_email', FROM_EMAIL, INTO_EMAIL, 'enquiries owner');
  await reassignEmail(sb, 'organiser_claim_requests', 'claimant_email', FROM_EMAIL, INTO_EMAIL, 'claim requests');
  await reassignEmail(sb, 'organiser_member_roster', 'email', FROM_EMAIL, INTO_EMAIL, 'roster email');

  // Merge hub_accounts flags onto Paul, then drop Phil's hub_accounts
  const fromHub = await sb.from('hub_accounts').select('*').eq('user_id', fromUser.id).maybeSingle();
  const intoHub = await sb.from('hub_accounts').select('*').eq('user_id', intoUser.id).maybeSingle();
  if (fromHub.error) throw new Error(fromHub.error.message);
  if (intoHub.error) throw new Error(intoHub.error.message);

  if (fromHub.data && intoHub.data) {
    const patch = {
      organiser_access_at: intoHub.data.organiser_access_at || fromHub.data.organiser_access_at,
      organiser_email_verified_at:
        intoHub.data.organiser_email_verified_at || fromHub.data.organiser_email_verified_at,
      organiser_terms_accepted_at:
        intoHub.data.organiser_terms_accepted_at || fromHub.data.organiser_terms_accepted_at,
      organiser_opportunity_terms_accepted_at:
        intoHub.data.organiser_opportunity_terms_accepted_at ||
        fromHub.data.organiser_opportunity_terms_accepted_at,
      organiser_ui_hidden_at: null,
    };
    if (APPLY) {
      const { error } = await sb.from('hub_accounts').update(patch).eq('user_id', intoUser.id);
      if (error) throw new Error('hub_accounts merge: ' + error.message);
      const { error: delErr } = await sb.from('hub_accounts').delete().eq('user_id', fromUser.id);
      if (delErr) throw new Error('hub_accounts delete source: ' + delErr.message);
    }
    log('hub_accounts: merge flags onto Paul, delete Phil row');
  } else if (fromHub.data && !intoHub.data) {
    if (APPLY) {
      const { error } = await sb
        .from('hub_accounts')
        .update({ user_id: intoUser.id })
        .eq('user_id', fromUser.id);
      if (error) throw new Error('hub_accounts reassign: ' + error.message);
    }
    log('hub_accounts: move Phil row onto Paul user_id');
  }

  if (fromAid) {
    if (APPLY) {
      const { error } = await sb.from('attendees').delete().eq('id', fromAid);
      if (error) throw new Error('delete source attendee: ' + error.message);
    }
    log('delete source attendee', fromAid);
  }

  if (APPLY) {
    const { error } = await sb.auth.admin.deleteUser(fromUser.id);
    if (error) throw new Error('delete source auth user: ' + error.message);
    log('deleted auth user', fromUser.id);
  } else {
    log('would delete auth user', fromUser.id);
  }

  console.log('');
  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to perform the merge.');
  } else {
    console.log(`Done. ${INTO_EMAIL} now owns ${FROM_EMAIL}'s Hub data. ${FROM_EMAIL} can no longer sign in.`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
