#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-ss-and-ts-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/354_tina_seed_ss_and_ts_batch.sql'),
  'utf8'
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 174, '174 contacts');
assert(!/Ss and Ts\.xlsx/i.test(JSON.stringify(batch)), 'json has no xlsx junk');
assert(!/Excel\]/.test(JSON.stringify(batch)), 'json has no Excel] junk');
assert(!/Ss and Ts\.xlsx/i.test(sql), 'sql has no xlsx junk');
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
  assert(!/\[[^\]]+\]/.test(c.location || ''), 'no bracket links in location ' + c.fullName);
  assert(!/\[[^\]]+\.(com|co\.uk|uk|org)/i.test(c.blurb || ''), 'no bracket links in blurb ' + c.fullName);
});

assert(emails.has('saadiaasghar@aol.com'), 'Saadia Khan');
assert(emails.has('tyler.davidsonjoyner@theskillsnetwork.com'), 'Tyler Davidson-Joyner');
const sally = batch.contacts.find((c) => c.email && c.fullName === 'Sally Marshall');
assert(sally && sally.location === 'Hythe, England', 'Sally location cleaned of link citation');
const sonny = batch.contacts.find((c) => c.fullName === 'Sonny Kurmi');
assert(sonny && !/\[/.test(sonny.location || ''), 'Sonny location cleaned');
assert(withCountry === 174, 'all have country');
console.log('ok — tina seed ss-and-ts batch (' + batch.contacts.length + ', location links stripped)');
