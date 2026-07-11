#!/usr/bin/env node
/**
 * Copy secrets from local.env into .env and .env.local for `vercel dev`.
 * Vercel CLI does not read local.env; edit local.env, then run this (or npm run sync-env).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const localEnvPath = path.join(root, 'local.env');
const envPath = path.join(root, '.env');
const envLocalPath = path.join(root, '.env.local');

if (!fs.existsSync(localEnvPath)) {
  console.error('Missing local.env — create it from .env.example and add your Supabase keys.');
  process.exit(1);
}

const localVars = dotenv.parse(fs.readFileSync(localEnvPath, 'utf8'));
const keys = Object.keys(localVars).filter((k) => localVars[k] != null && String(localVars[k]).trim() !== '');

function parseExisting(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergeVars(base, overrides) {
  const out = { ...base };
  keys.forEach((key) => {
    out[key] = localVars[key];
  });
  return out;
}

function formatEnv(vars) {
  return (
    Object.entries(vars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'
  );
}

function writeEnvFile(filePath, vars, headerLines) {
  const body = formatEnv(vars);
  const header = headerLines.length ? headerLines.join('\n') + '\n\n' : '';
  fs.writeFileSync(filePath, header + body, 'utf8');
}

const envHeader = [
  '# Local only — do not commit. Synced from local.env for vercel dev.',
  '# Edit local.env, then run: npm run sync-env',
];
writeEnvFile(envPath, mergeVars(parseExisting(envPath), localVars), envHeader);

const existingLocal = parseExisting(envLocalPath);
const vercelOnly = Object.fromEntries(
  Object.entries(existingLocal).filter(([key]) => /^VERCEL_/i.test(key))
);
writeEnvFile(
  envLocalPath,
  mergeVars(vercelOnly, localVars),
  ['# Created by Vercel CLI — Supabase keys synced from local.env']
);

console.log('Synced', keys.length, 'vars from local.env → .env and .env.local');
