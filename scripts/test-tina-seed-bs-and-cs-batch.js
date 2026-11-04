#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-bs-and-cs-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/357_tina_seed_bs_and_cs_batch.sql'),
  'utf8'
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 109, '109 contacts');
assert(!/Bs and Cs\.xlsx/i.test(JSON.stringify(batch)), 'json has no xlsx junk');
assert(!/Book\d*\.xlsx/i.test(JSON.stringify(batch)), 'json has no Book.xlsx junk');
assert(!/Excel\]/.test(JSON.stringify(batch)), 'json has no Excel] junk');
assert(!/Bs and Cs\.xlsx/i.test(sql), 'sql has no xlsx junk');
assert(!/Book\d*\.xlsx/i.test(sql), 'sql has no Book.xlsx junk');
assert(!/Excel\]/.test(sql), 'sql has no Excel] junk');

const emails = new Set();
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
  assert(!/https?:\/\//i.test(c.location || ''), 'no url in location ' + c.fullName);
  assert(!/\[[^\]]+\]/.test(c.location || ''), 'no bracket junk in location ' + c.fullName);
  assert(!/\.xlsx/i.test((c.location || '') + (c.blurb || '')), 'no xlsx in loc/blurb ' + c.fullName);
  assert(c.country, 'country ' + c.fullName);
});

assert(emails.has('barbara@barbaraleatham.co.uk'), 'Barbara Leatham');
assert(emails.has('cristina@cvgsolutions.co.uk'), 'Cristina Vannini-Goodchild');
const barbara = batch.contacts.find((c) => c.fullName === 'Barbara Leatham');
assert(barbara && barbara.location === 'Wiltshire', 'Barbara location cleaned');
console.log('ok — tina seed bs-and-cs batch (' + batch.contacts.length + ', junk stripped)');
