#!/usr/bin/env node
/**
 * Eligibility rules for the 4-month no-recent-event organiser nudge.
 * Usage: node scripts/test-organiser-no-recent-event-nudge.js
 */

const INACTIVE_DAYS = 120;
const COOLDOWN_DAYS = 120;

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isEligible({ lastEventAt, organiserCreatedAt, lastNudgeAt, now = Date.now() }) {
  const inactiveBefore = new Date(now - INACTIVE_DAYS * 86400000).toISOString();
  const cooldownBefore = new Date(now - COOLDOWN_DAYS * 86400000).toISOString();
  if (lastNudgeAt && lastNudgeAt > cooldownBefore) return false;
  const activityAt = lastEventAt || organiserCreatedAt || null;
  if (activityAt && activityAt > inactiveBefore) return false;
  return true;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

const now = Date.now();
assert(
  !isEligible({
    lastEventAt: daysAgoIso(30),
    organiserCreatedAt: daysAgoIso(400),
    lastNudgeAt: null,
    now,
  }),
  'recent event creator is not eligible'
);
assert(
  isEligible({
    lastEventAt: daysAgoIso(150),
    organiserCreatedAt: daysAgoIso(400),
    lastNudgeAt: null,
    now,
  }),
  'event 5 months ago is eligible'
);
assert(
  !isEligible({
    lastEventAt: null,
    organiserCreatedAt: daysAgoIso(30),
    lastNudgeAt: null,
    now,
  }),
  'new organiser with no events is not eligible yet'
);
assert(
  isEligible({
    lastEventAt: null,
    organiserCreatedAt: daysAgoIso(150),
    lastNudgeAt: null,
    now,
  }),
  'organiser with no events for 5 months is eligible'
);
assert(
  !isEligible({
    lastEventAt: daysAgoIso(200),
    organiserCreatedAt: daysAgoIso(400),
    lastNudgeAt: daysAgoIso(10),
    now,
  }),
  'cooldown blocks re-send within 4 months'
);
assert(
  isEligible({
    lastEventAt: daysAgoIso(200),
    organiserCreatedAt: daysAgoIso(400),
    lastNudgeAt: daysAgoIso(150),
    now,
  }),
  'eligible again after cooldown'
);

console.log('All no-recent-event eligibility checks passed.');
