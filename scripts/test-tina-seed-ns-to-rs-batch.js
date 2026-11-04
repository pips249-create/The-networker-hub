#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-ns-to-rs-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/353_tina_seed_ns_to_rs_batch.sql'),
  'utf8'
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 156, '156 contacts');
assert(!/Ns to Rs\.xlsx/i.test(JSON.stringify(batch)), 'json has no xlsx junk');
assert(!/Excel\]/.test(JSON.stringify(batch)), 'json has no Excel] junk');
assert(!/Ns to Rs\.xlsx/i.test(sql), 'sql has no xlsx junk');
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
  assert(!/Ns to Rs\.xlsx/i.test(c.location || ''), 'clean location ' + c.fullName);
  assert(!/Excel\]/.test(c.blurb || ''), 'clean blurb ' + c.fullName);
});

assert(emails.has('naz821uk@yahoo.co.uk'), 'Naomi Rose');
assert(emails.has('ruth@oasisaccountants.co.uk'), 'Ruth Clark');
assert(withCountry === 156, 'all have country');
console.log('ok — tina seed ns-to-rs batch (' + batch.contacts.length + ', junk stripped)');
