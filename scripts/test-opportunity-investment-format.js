#!/usr/bin/env node
/**
 * Investment display formatting for opportunity cards.
 * Run: node scripts/test-opportunity-investment-format.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../js/opportunities-catalog.js'), 'utf8');
const sandbox = { window: {}, console };
vm.runInNewContext(src, sandbox);
const catalog = sandbox.window.HubOpportunitiesCatalog;
if (!catalog || typeof catalog.formatInvestmentDisplay !== 'function') {
  console.error('FAIL could not load HubOpportunitiesCatalog.formatInvestmentDisplay');
  process.exit(1);
}

let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) {
    console.error('FAIL', label, '| got:', JSON.stringify(got), '| expected:', JSON.stringify(expected));
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('raw digits', catalog.formatInvestmentDisplay('100001'), '£100,001');
assert('pound no commas', catalog.formatInvestmentDisplay('£100001'), '£100,001');
assert('already formatted', catalog.formatInvestmentDisplay('£100,000'), '£100,000');
assert('suffix VAT', catalog.formatInvestmentDisplay('£15,000 + VAT'), '£15,000 + VAT');
assert('suffix plus', catalog.formatInvestmentDisplay('250000 +'), '£250,000 +');
assert('small thousands', catalog.formatInvestmentDisplay('8000'), '£8,000');
assert('comma without pound', catalog.formatInvestmentDisplay('30,000'), '£30,000');
assert('on request', catalog.formatInvestmentDisplay('On request'), 'On request');
assert('enquire', catalog.formatInvestmentDisplay('enquire'), 'On request');
assert('percent commission-like', catalog.formatInvestmentDisplay('10%'), '10%');
assert('meta investment key', catalog.formatMetaDisplayValue('Investment', '100001'), '£100,001');
assert('meta non-invest passthrough', catalog.formatMetaDisplayValue('Location', 'UK-wide'), 'UK-wide');

process.exit(failed ? 1 : 0);
