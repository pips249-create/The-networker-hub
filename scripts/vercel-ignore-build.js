#!/usr/bin/env node
/**
 * Vercel Ignored Build Step.
 *
 * Exit 0 → skip build (saves Build CPU Minutes).
 * Exit 1 → continue build.
 *
 * Pair with vercel.json `git.deploymentEnabled` which turns off automatic
 * deployments for `cursor/**` agent branches entirely (preferred — no slot use).
 * This script is the safety net for any remaining preview builds.
 *
 * Requires: Project → Settings → Environment Variables →
 * "Automatically expose System Environment Variables" enabled.
 */
'use strict';

const { execFileSync } = require('child_process');

const targetEnv = String(process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || '').toLowerCase();
const prId = String(process.env.VERCEL_GIT_PULL_REQUEST_ID || '').trim();
const ref = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
const previousSha = String(process.env.VERCEL_GIT_PREVIOUS_SHA || '').trim();

/** Pathspecs excluded from "did anything deployable change?" */
const EXCLUDE_PATHSPECS = [
  ':(exclude)**/*.md',
  ':(exclude)docs/**',
  ':(exclude)ops/**',
  ':(exclude)email-templates/**',
  ':(exclude)marketing/**',
  ':(exclude).cursor/**',
  ':(exclude)supabase/migrations/**',
  ':(exclude)**/*.pdf',
];

function skip(reason) {
  console.log('[vercel-ignore-build] skip:', reason);
  process.exit(0);
}

function build(reason) {
  console.log('[vercel-ignore-build] build:', reason);
  process.exit(1);
}

// Always ship production (and any custom environments that are not preview).
if (targetEnv && targetEnv !== 'preview') {
  build('target env is ' + targetEnv);
}

// Preview pushes with no open PR (branch-only) — skip.
if (!prId) {
  skip('preview with no pull request (ref=' + (ref || 'unknown') + ')');
}

if (previousSha) {
  try {
    execFileSync(
      'git',
      ['diff', '--quiet', previousSha, 'HEAD', '--', '.'].concat(EXCLUDE_PATHSPECS),
      { stdio: 'pipe' }
    );
    skip('only docs/marketing/ops/email/migration/pdf paths changed since ' + previousSha.slice(0, 7));
  } catch (err) {
    // git diff --quiet exits 1 when a relevant diff exists → build.
    if (err && err.status === 1) {
      build('relevant paths changed on PR #' + prId);
    }
    console.warn(
      '[vercel-ignore-build] diff check failed; building to be safe:',
      err && err.message ? err.message : err
    );
    build('diff check failed; fail-open');
  }
}

build('preview PR #' + prId + ' (no previous SHA to diff)');
