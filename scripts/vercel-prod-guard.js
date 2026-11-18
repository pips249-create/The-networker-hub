#!/usr/bin/env node
/**
 * Guard for npm run deploy — push to main already triggers Production.
 * Set ALLOW_VERCEL_PROD=1 only when the Git deploy failed or never started.
 */
const { spawnSync } = require('child_process');

if (process.env.ALLOW_VERCEL_PROD !== '1') {
  console.error(`
Refusing CLI production deploy.

Pushing to main already starts one Vercel Production build.
A second CLI deploy doubles Build CPU (see docs/VERCEL-BUILD-COSTS.md).

If Git deploy failed and you still need CLI:
  ALLOW_VERCEL_PROD=1 npm run deploy
`);
  process.exit(1);
}

const result = spawnSync('npx', ['vercel', '--prod', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status == null ? 1 : result.status);
