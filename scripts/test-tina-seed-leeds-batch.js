#!/usr/bin/env node
/**
 * Validates the Leeds TINA seed batch JSON (no DB).
 */
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-leeds-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 28, '28 contacts');

const emails = new Set();
batch.contacts.forEach((c) => {
  const n = normalizeSeedInput(
    {
      fullName: c.fullName,
      email: c.email,
      company: c.company,
      industry: c.industry,
      notes: 'Phone: ' + c.phone,
      source: 'rosie',
      status: 'active',
    },
    { partial: false }
  );
  assert(n.ok, 'valid row: ' + c.fullName + ' ' + JSON.stringify(n.errors || {}));
  assert(n.fields.email, 'email required: ' + c.fullName);
  assert(!emails.has(n.fields.email), 'unique email: ' + n.fields.email);
  emails.add(n.fields.email);
  assert(c.phone, 'phone present for notes: ' + c.fullName);
});

assert(emails.has('nikki@talespincopy.co.uk'), 'Nikki email');
assert(
  batch.contacts.some((c) => /Talespin Copy/i.test(c.company || '')),
  'Nikki company inferred as Talespin Copy'
);
assert(emails.has('mark@forthwise.co.uk'), 'Mark Kelly email');
assert(
  batch.contacts.some((c) => /Business Consultancy/i.test(c.industry || '')),
  'Mark industry typo corrected'
);

console.log('ok — tina seed leeds batch (' + batch.contacts.length + ')');
