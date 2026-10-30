#!/usr/bin/env node
/**
 * Public /api/opportunities list must stay slim — full about/owner email payloads
 * were ~800KB and multi-second on cold hits.
 *
 * Run: node scripts/test-opportunity-browse-cards.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let failed = 0;
function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const src = fs.readFileSync(path.join(__dirname, '../api/_lib/supabase-opportunities.js'), 'utf8');
assert('browse select is defined', /const BROWSE_OPPORTUNITY_SELECT/.test(src));
assert('browse select skips about', !/BROWSE_OPPORTUNITY_SELECT = \[[\s\S]*?'about'/.test(src));
assert('browse select skips contact_email', !/BROWSE_OPPORTUNITY_SELECT = \[[\s\S]*?'contact_email'/.test(src));
assert('browse select skips pending_review_payload', !/BROWSE_OPPORTUNITY_SELECT = \[[\s\S]*?'pending_review_payload'/.test(src));
assert('rowToBrowseCard truncates description', /BROWSE_DESCRIPTION_MAX/.test(src));
assert('listPublishedOpportunityCards is exported', /listPublishedOpportunityCards/.test(src));

const apiSrc = fs.readFileSync(path.join(__dirname, '../api/opportunities.js'), 'utf8');
assert(
  'public list uses browse cards',
  /listPublishedOpportunityCards/.test(apiSrc) && !/listPublishedOpportunities\(\)/.test(apiSrc)
);

const catalogSrc = fs.readFileSync(path.join(__dirname, '../js/opportunities-catalog.js'), 'utf8');
assert(
  'catalogue list fetch honours HTTP cache',
  /fetch\('\/api\/opportunities', \{ credentials: 'same-origin' \}/.test(catalogSrc) &&
    !/fetch\('\/api\/opportunities', \{ credentials: 'same-origin', cache: 'no-store' \}/.test(
      catalogSrc
    )
);

const { rowToBrowseCard, rowToListing } = require('../api/_lib/supabase-opportunities');
const row = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'demo-franchise',
  type: 'franchise',
  tags: ['franchise'],
  featured: false,
  featured_until: null,
  host: 'Demo Host',
  host_initials: 'DH',
  host_color: '#123456',
  title: 'Demo franchise',
  description: 'B'.repeat(500),
  about: ['Secret paragraph', 'Another paragraph'],
  meta: [{ key: 'Investment', val: '£10k' }],
  category: 'retail',
  categories: ['retail'],
  contact_email: 'owner@example.com',
  image_url: '',
  logo_url: '',
  status: 'published',
  approval_status: 'Approved',
  owner_email: 'owner@example.com',
  ownership_claim_status: 'claimed',
  listing_paid_at: '2026-01-01T00:00:00.000Z',
  listing_expires_at: '2099-01-01T00:00:00.000Z',
  listing_stripe_subscription_id: 'sub_secret',
  outcode: 'M1',
  region_slug: 'north-west',
  created_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-01T00:00:00.000Z',
  view_count: 3,
  pending_review_payload: { row: { title: 'x' }, submittedAt: '2026-01-02T00:00:00.000Z' },
  rejection_note: 'nope',
};

const card = rowToBrowseCard(row);
assert('browse card truncates desc', card.desc.length <= 320);
assert('browse card has empty about', Array.isArray(card.about) && card.about.length === 0);
assert('browse card omits ownerEmail', card.ownerEmail == null || card.ownerEmail === '');
assert('browse card omits contactEmail', card.contactEmail == null || card.contactEmail === '');
assert(
  'browse card omits stripe subscription id',
  card.listingStripeSubscriptionId == null || card.listingStripeSubscriptionId === ''
);
assert('browse card keeps title', card.title === 'Demo franchise');
assert('browse card keeps claimable boolean', typeof card.claimable === 'boolean');

const full = rowToListing(row);
assert('detail listing keeps about', Array.isArray(full.about) && full.about.length === 2);
assert('detail listing keeps ownerEmail', full.ownerEmail === 'owner@example.com');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll opportunity browse card checks passed');
