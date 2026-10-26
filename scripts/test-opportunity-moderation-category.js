#!/usr/bin/env node
/**
 * Category taxonomy must not trip recruitment-primary moderation.
 * Legacy slug "mlm" used to be scanned as free text and blocked publish.
 */
const assert = require('assert');
const clientScan = require('../js/opportunity-moderation-scan.js');
const {
  scanOpportunityRedFlags,
  collectOpportunityText,
} = require('../api/_lib/opportunity-moderation');

function ok(name, condition) {
  assert.ok(condition, name);
  console.log('ok -', name);
}

/** Mirrors api/_lib/supabase-opportunities.normalizeCategoryId */
function normalizeCategoryId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  if (!id) return '';
  if (id === 'mlm') return 'network-marketing';
  return id;
}

ok('legacy mlm category id normalises', normalizeCategoryId('mlm') === 'network-marketing');
ok('network-marketing category id unchanged', normalizeCategoryId('Network-Marketing') === 'network-marketing');

const listingWithTaxonomy = {
  title: 'Utility Warehouse Partner',
  description: 'Sell energy and broadband products to local customers.',
  about: ['Product-led partner role focused on customer savings.'],
  host: 'Example Partner',
  category: 'mlm',
  type: 'network-marketing',
  tags: ['network-marketing', 'cat-mlm'],
  meta: [
    { key: 'Investment', val: '£0' },
    { key: 'Location', val: 'UK-wide' },
  ],
};

ok(
  'client scan ignores taxonomy slug mlm',
  clientScan.scanOpportunityRedFlags(listingWithTaxonomy, { includeMissingFields: false }) === null
);

const serverResult = scanOpportunityRedFlags(listingWithTaxonomy);
ok(
  'server scan ignores taxonomy slug mlm',
  serverResult === null || !serverResult.reasons.some((r) => r.id === 'recruitment_primary')
);

const everydayPitch = {
  title: 'Utility Warehouse Partner',
  description: 'Be your own boss and build your team selling energy and broadband.',
  category: 'retail',
  type: 'network-marketing',
  meta: [
    { key: 'Investment', val: '£0' },
    { key: 'Location', val: 'UK-wide' },
  ],
};
ok(
  'client allows be your own boss / build your team',
  clientScan.scanOpportunityRedFlags(everydayPitch, { includeMissingFields: false }) === null
);
ok(
  'server allows be your own boss / build your team',
  scanOpportunityRedFlags(everydayPitch) === null ||
    !scanOpportunityRedFlags(everydayPitch).reasons.some((r) => r.id === 'recruitment_primary')
);

const stillBlocked = {
  title: 'Utility Warehouse Partner',
  description: 'Earn from your downline and recruit for income.',
  category: 'retail',
  type: 'franchise',
  meta: [
    { key: 'Investment', val: '£500' },
    { key: 'Location', val: 'Leeds' },
  ],
};
const clientHit = clientScan.scanOpportunityRedFlags(stillBlocked, { includeMissingFields: false });
ok(
  'client still flags recruitment wording in free text',
  Boolean(clientHit && clientHit.reasons.some((r) => r.id === 'recruitment_primary'))
);
const serverHit = scanOpportunityRedFlags(stillBlocked);
ok(
  'server still flags recruitment wording in free text',
  Boolean(serverHit && serverHit.reasons.some((r) => r.id === 'recruitment_primary'))
);

const text = collectOpportunityText(listingWithTaxonomy);
ok('collectOpportunityText omits category/type/tags', !/\bmlm\b/.test(text) && !/cat-mlm/.test(text));
ok(
  'client collectOpportunityText omits taxonomy',
  !/\bmlm\b/.test(clientScan.collectOpportunityText(listingWithTaxonomy))
);

console.log('All opportunity moderation category checks passed.');
