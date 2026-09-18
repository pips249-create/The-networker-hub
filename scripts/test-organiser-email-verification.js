#!/usr/bin/env node
/**
 * Organiser email verification URL helpers (mirrors buildOrganiserVerifyEmailPath).
 */
const assert = require('assert');

function buildOrganiserVerifyEmailPath(code, email) {
  const address = String(email || '')
    .trim()
    .toLowerCase();
  let path =
    '/organiser/verify-email?code=' + encodeURIComponent(String(code || '').trim());
  if (address) {
    path += '&email=' + encodeURIComponent(address);
  }
  return path;
}

const path = buildOrganiserVerifyEmailPath('482917', 'Organiser@Example.com');
assert.match(path, /^\/organiser\/verify-email\?code=482917&email=/);
assert(path.includes('organiser%40example.com'), 'email should be normalised and encoded');

const codeOnly = buildOrganiserVerifyEmailPath('000001', '');
assert.equal(codeOnly, '/organiser/verify-email?code=000001');

console.log('OK  organiser email verification paths');
