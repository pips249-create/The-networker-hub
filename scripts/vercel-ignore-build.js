#!/usr/bin/env node
/**
 * Vercel Ignored Build Step — production only.
 *
 * Exit 0 → skip build (saves Build CPU Minutes).
 * Exit 1 → continue build.
 *
 * Pair with vercel.json:
 *   git.deploymentEnabled: { "**": false, "main": true }
 * so non-main branches never start a deployment. This script is the
 * safety net if a preview still gets queued.
 *
 * Requires: Project → Settings → Environment Variables →
 * "Automatically expose System Environment Variables" enabled.
 */
'use strict';

const targetEnv = String(process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || '').toLowerCase();
const ref = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();

function skip(reason) {
  console.log('[vercel-ignore-build] skip:', reason);
  process.exit(0);
}

function build(reason) {
  console.log('[vercel-ignore-build] build:', reason);
  process.exit(1);
}

if (targetEnv === 'production' || ref === 'main') {
  build('production / main');
}

skip('not production (env=' + (targetEnv || 'unknown') + ', ref=' + (ref || 'unknown') + ')');
