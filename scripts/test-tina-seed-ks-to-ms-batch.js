#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-ks-to-ms-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/356_tina_seed_ks_to_ms_batch.sql'),
  'utf8'
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 213, '213 contacts');
assert(!/Ks to Ms\.xlsx/i.test(JSON.stringify(batch)), 'json has no xlsx junk');
assert(!/Book2\.xlsx/i.test(JSON.stringify(batch)), 'json has no Book2.xlsx junk');
assert(!/Excel\]/.test(JSON.stringify(batch)), 'json has no Excel] junk');
assert(!/Ks to Ms\.xlsx/i.test(sql), 'sql has no xlsx junk');
assert(!/Book2\.xlsx/i.test(sql), 'sql has no Book2.xlsx junk');
assert(!/Excel\]/.test(sql), 'sql has no Excel] junk');

const emails = new Set();
let withCountry = 0;
batch.contacts.forEach((c) => {
  const n = normalizeSeedInput(
    {
      fullName: c.fullName,
      email: c.email,
      company: c.company,
      jobTitle: c.jobTitle,
      professionalRole: c.professionalRole,
      linkedinUrl: c.linkedinUrl || '',
      websiteUrl: c.websiteUrl || '',
      location: c.location || '',
      country: c.country || '',
      blurb: c.blurb || '',
      notes: c.notes || '',
      source: 'rosie',
      status: 'active',
    },
    { partial: false }
  );
  assert(n.ok, 'valid: ' + c.fullName + ' ' + JSON.stringify(n.errors || {}));
  assert(!emails.has(n.fields.email), 'unique ' + n.fields.email);
  emails.add(n.fields.email);
  if (c.country) withCountry += 1;
  assert(!/https?:\/\//i.test(c.location || ''), 'no url in location ' + c.fullName);
  assert(!/www\./i.test(c.location || ''), 'no www in location ' + c.fullName);
  assert(!/\[[^\]]+\]/.test(c.location || ''), 'no bracket junk in location ' + c.fullName);
  assert(!/\.xlsx/i.test(c.location || ''), 'no xlsx in location ' + c.fullName);
  assert(!/\[[^\]]+\]/.test(c.blurb || ''), 'no bracket junk in blurb ' + c.fullName);
  assert(!/\.xlsx/i.test(c.blurb || ''), 'no xlsx in blurb ' + c.fullName);
});

assert(emails.has('karen@karenbashford.com'), 'Karen Bashford');
assert(emails.has('contact@monaking.co.uk'), 'Mona King');
const keith = batch.contacts.find((c) => c.fullName === 'Keith Blakemore-Noble');
assert(keith && keith.location === 'Scotland', 'Keith location cleaned of Book2.xlsx junk');
assert(withCountry === 213, 'all have country');
console.log('ok — tina seed ks-to-ms batch (' + batch.contacts.length + ', hyperlinks/xlsx junk stripped)');
