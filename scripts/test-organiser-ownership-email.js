#!/usr/bin/env node
/**
 * Checks the ownership-transfer email is not the cold claim campaign.
 * Usage: node scripts/test-organiser-ownership-email.js
 */
const fs = require('fs');
const path = require('path');
const {
  OWNERSHIP_TRANSFER_SLUG,
  ownershipTransferLead,
  ownershipTransferSubject,
} = require('../api/_lib/organiser-ownership-email');
const { getBrandedEmailSubject, resolveBrandedEmailBody } = require('../api/_lib/branded-email-templates');
const { replacePlaceholders } = require('../api/_lib/send-template-email');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const name = 'OxfordSTEM.Network';
const requestedSubject = ownershipTransferSubject(name, true);
const transferSubject = ownershipTransferSubject(name, false);
const requestedLead = ownershipTransferLead(name, true);
const transferLead = ownershipTransferLead(name, false);

assert('slug is the takeover template', OWNERSHIP_TRANSFER_SLUG === 'organiser_ownership_transfer');
assert('claim approval subject names the request', /request to manage OxfordSTEM\.Network is approved/.test(requestedSubject));
assert('claim approval subject is not the cold campaign', !/FREE to claim/i.test(requestedSubject));
assert('manual transfer subject is not the cold campaign', !/FREE to claim/i.test(transferSubject));
assert('claim approval lead mentions the request', /asked to claim and manage OxfordSTEM\.Network/.test(requestedLead));
assert('manual transfer lead mentions the transfer', /transferred OxfordSTEM\.Network/.test(transferLead));

const brandedSubject = getBrandedEmailSubject(OWNERSHIP_TRANSFER_SLUG);
assert('branded subject is the approval line', /request to manage/.test(brandedSubject));
assert('branded subject is not the cold campaign', !/FREE to claim/i.test(brandedSubject));

const resolved = resolveBrandedEmailBody(OWNERSHIP_TRANSFER_SLUG, '');
const html = replacePlaceholders(resolved.bodyHtml, {
  organiser_name: name,
  claim_url: 'https://www.thenetworkeruk.com/organiser/claim?token=test',
  lead: requestedLead,
  site_url: 'https://www.thenetworkeruk.com',
  support_email: 'hi@thenetworkeruk.com',
});
assert('body uses the takeover template', /Take over the page/.test(html));
assert('body includes the approval lead', /asked to claim and manage OxfordSTEM\.Network/.test(html));
assert('body is not the cold campaign', !/It's FREE|It&rsquo;s FREE|this morning|We've emailed before|We&rsquo;ve emailed before/i.test(html));

const file = fs.readFileSync(
  path.join(__dirname, '../email-templates/organiser-ownership-transfer.html'),
  'utf8'
);
assert('template file has the layout marker', file.includes('hub-email-layout-v3-purple'));

if (!process.exitCode) {
  console.log('All organiser ownership email checks passed');
}
