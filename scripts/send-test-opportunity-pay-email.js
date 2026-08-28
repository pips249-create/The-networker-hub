#!/usr/bin/env node
/**
 * Send the approved-listing pay email (Stripe checkout link) for a hub/seed opportunity.
 *
 * Usage:
 *   node scripts/send-test-opportunity-pay-email.js hancher249@gmail.com
 *   node scripts/send-test-opportunity-pay-email.js hancher249@gmail.com --title="York Open Day Demo"
 *
 * Requires RESEND_API_KEY (+ Supabase admin env) in local.env or .env.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { rowToListing } = require('../api/_lib/supabase-opportunities');
const { sendOpportunityListingApprovedPayEmail } = require('../api/_lib/opportunity-emails');

function argValue(name) {
  const prefix = name + '=';
  for (let i = 2; i < process.argv.length; i += 1) {
    const part = String(process.argv[i] || '');
    if (part === name.replace('=', '')) return String(process.argv[i + 1] || '').trim();
    if (part.indexOf(prefix) === 0) return part.slice(prefix.length).trim();
  }
  return '';
}

async function pickListing(sb, titleHint) {
  const hint = String(titleHint || '').trim();
  let query = sb
    .from('business_opportunities')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(40);
  if (hint) {
    query = query.ilike('title', '%' + hint.replace(/[%_]/g, '') + '%');
  } else {
    query = query.or('title.ilike.[TEST]%,title.ilike.%seed%,title.ilike.%York Open Day Demo%');
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data || [];
  if (!rows.length) {
    throw new Error(
      hint
        ? 'No listing matched title hint: ' + hint
        : 'No [TEST], seed, or York Open Day Demo listing found.'
    );
  }
  return rows[0];
}

async function main() {
  const to = String(process.argv[2] || '')
    .trim()
    .toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error(
      'Usage: node scripts/send-test-opportunity-pay-email.js you@example.com [--title="Listing title"]'
    );
    process.exit(1);
  }
  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const titleHint = argValue('--title');
  const row = await pickListing(sb, titleHint);
  const now = new Date().toISOString();

  const patch = {
    owner_email: to,
    approval_status: 'Approved',
    updated_at: now,
  };
  if (row.listing_paid_at && !process.argv.includes('--keep-paid')) {
    patch.listing_paid_at = null;
    patch.listing_expires_at = null;
  }
  if (String(row.status || '').toLowerCase() === 'published' && !row.listing_paid_at) {
    patch.status = 'draft';
  }

  const { data: updated, error: updateErr } = await sb
    .from('business_opportunities')
    .update(patch)
    .eq('id', row.id)
    .select('*')
    .single();
  if (updateErr) throw new Error(updateErr.message);

  const listing = rowToListing(updated);
  const result = await sendOpportunityListingApprovedPayEmail(listing);

  console.log('Listing:', updated.title, '(' + updated.id + ')');
  console.log('Owner email set to:', to);
  console.log('Email result:', result);
  console.log(
    'Pay link:',
    (process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '') +
      '/organiser/opportunity-edit?id=' +
      encodeURIComponent(updated.id) +
      '&checkout=start'
  );
}

main().catch(function (err) {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
