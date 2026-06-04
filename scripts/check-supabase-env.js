#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

function jwtRole(key) {
  if (!key || !key.includes('.')) return null;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload.role || null;
  } catch {
    return null;
  }
}

const url = (process.env.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
const anon = (process.env.SUPABASE_ANON_KEY || '').trim().replace(/^['"]|['"]$/g, '');
const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^['"]|['"]$/g, '');

console.log('SUPABASE_URL:', url ? (url.startsWith('https://') ? 'OK' : 'BAD') : 'MISSING');
console.log('SUPABASE_ANON_KEY role:', jwtRole(anon) || 'missing/invalid');
console.log('SUPABASE_SERVICE_ROLE_KEY role:', jwtRole(service) || 'missing/invalid');

if (jwtRole(anon) === 'service_role') {
  console.log('\nSwap: put the anon (public) key in SUPABASE_ANON_KEY.');
}
if (jwtRole(service) === 'anon') {
  console.log('\nSwap: put the service_role (secret) key in SUPABASE_SERVICE_ROLE_KEY.');
}
