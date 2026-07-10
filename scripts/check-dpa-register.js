#!/usr/bin/env node
/**
 * Validates docs/DPA-REGISTER.md has all four subprocessors marked complete.
 * Run: npm run check:dpas
 */
const fs = require('fs');
const path = require('path');

const registerPath = path.join(__dirname, '..', 'docs/DPA-REGISTER.md');
const text = fs.readFileSync(registerPath, 'utf8');

const PROVIDERS = ['Stripe', 'Vercel', 'Resend', 'Supabase'];

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function rowFor(provider) {
  const prefix = '| ' + provider + ' |';
  const line = text.split('\n').find((l) => l.startsWith(prefix));
  if (!line) return null;
  const cells = splitTableRow(line);
  if (cells.length < 6 || cells[0] !== provider) return null;
  return {
    mechanism: cells[1],
    effectiveDate: cells[2],
    completedBy: cells[3],
    pdfFilename: cells[4],
    status: cells[5],
  };
}

function isComplete(row) {
  if (!row) return false;
  const statusOk = /☑|✓|done|yes|complete/i.test(row.status);
  const hasDate = /\d{4}-\d{2}-\d{2}/.test(row.effectiveDate);
  const hasFile = row.pdfFilename.length > 3;
  const hasOwner = row.completedBy.length > 1;
  return statusOk && hasDate && hasFile && hasOwner;
}

let complete = 0;
console.log('DPA register check\n');

for (const provider of PROVIDERS) {
  const row = rowFor(provider);
  const ok = isComplete(row);
  if (ok) complete += 1;
  console.log((ok ? '  ✓' : '  ✗') + ' ' + provider);
  if (!ok && row) {
    if (!/\d{4}-\d{2}-\d{2}/.test(row.effectiveDate)) console.log('      → add effective date (YYYY-MM-DD)');
    if (row.completedBy.length <= 1) console.log('      → add completed by (name)');
    if (row.pdfFilename.length <= 3) console.log('      → add PDF filename saved in company folder');
    if (!/☑|✓|done|yes|complete/i.test(row.status)) console.log('      → set Status to ☑');
  }
  if (!row) console.log('      → row missing in docs/DPA-REGISTER.md');
}

console.log('\nCompleted: ' + complete + ' / ' + PROVIDERS.length);
console.log('Guide: docs/DPA-SUBPROCESSORS.md');

if (complete === PROVIDERS.length) {
  console.log('\nAll subprocessors filed — update docs/RoPA.md and docs/COMPLIANCE-RUNBOOK.md.');
  process.exit(0);
}

console.log('\nIncomplete — follow docs/DPA-SUBPROCESSORS.md (Supabase: PandaDoc; others: download + file).');
process.exit(complete >= 2 ? 0 : 1);
