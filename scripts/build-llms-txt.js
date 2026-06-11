#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildLlmsTxt } = require('../api/_lib/hubert-seo');

const target = path.join(__dirname, '..', 'llms.txt');
fs.writeFileSync(target, buildLlmsTxt(), 'utf8');
console.log('Wrote', target);
