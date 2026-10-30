#!/usr/bin/env node
/**
 * Unit tests for Hubert seed intro reminder + pause helpers (mocked Supabase).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  REMINDER_AFTER_DAYS,
  PAUSE_AFTER_DAYS,
  PAUSE_REASON,
  daysAgoIso,
  sendDueSeedIntroReminders,
  pauseUnresponsiveSeedIntros,
} = require('../api/_lib/hubert-seed-intro-followups');

assert.strictEqual(REMINDER_AFTER_DAYS, 5, 'reminder at day 5');
assert.strictEqual(PAUSE_AFTER_DAYS, 7, 'pause at day 7');
assert.strictEqual(PAUSE_REASON, 'intro_no_response', 'pause reason locked');

const nowMs = Date.parse('2026-10-30T12:00:00.000Z');
assert.ok(daysAgoIso(5, nowMs).startsWith('2026-10-25'), '5 days ago');
assert.ok(daysAgoIso(7, nowMs).startsWith('2026-10-23'), '7 days ago');

function chainable(result) {
  const api = {
    select() {
      return api;
    },
    eq() {
      return api;
    },
    not() {
      return api;
    },
    is() {
      return api;
    },
    lte() {
      return api;
    },
    order() {
      return api;
    },
    limit() {
      return Promise.resolve(result);
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    update() {
      return api;
    },
  };
  return api;
}

async function testReminderQuerySoftSkip() {
  const sb = {
    from(table) {
      assert.strictEqual(table, 'hubert_intro_requests');
      return chainable({
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.hubert_intro_requests' in the schema cache",
        },
      });
    },
  };
  const out = await sendDueSeedIntroReminders(sb, { nowMs });
  assert.strictEqual(out.skipped, true, 'soft-skip missing intro table');
  assert.strictEqual(out.reminded, 0, 'no reminders when table missing');
}

async function testPauseRequiresReminder() {
  const calls = [];
  const sb = {
    from(table) {
      calls.push(table);
      if (table === 'hubert_intro_requests') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          not() {
            return this;
          },
          is() {
            return this;
          },
          lte() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return Promise.resolve({
              data: [
                {
                  id: 'intro-1',
                  target_seed_id: 'seed-1',
                  emailed_at: '2026-10-20T12:00:00.000Z',
                  reminder_sent_at: '2026-10-25T12:00:00.000Z',
                  status: 'pending',
                },
              ],
              error: null,
            });
          },
        };
      }
      if (table === 'hubert_match_seed') {
        return {
          update(payload) {
            assert.strictEqual(payload.status, 'paused');
            assert.strictEqual(payload.pause_reason, 'intro_no_response');
            this._payload = payload;
            return this;
          },
          eq() {
            return this;
          },
          select() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: { id: 'seed-1' }, error: null });
          },
        };
      }
      throw new Error('unexpected table ' + table);
    },
  };
  const out = await pauseUnresponsiveSeedIntros(sb, { nowMs });
  assert.strictEqual(out.paused, 1, 'pauses active seed after reminder window');
  assert.ok(calls.includes('hubert_match_seed'), 'updates seed table');
}

const template = fs.readFileSync(
  path.join(__dirname, '../email-templates/hubert-intro-reminder.html'),
  'utf8'
);
assert.ok(template.includes('Quick reminder'), 'reminder email copy');
assert.ok(template.includes('This is my only reminder'), 'one-reminder promise');

const cron = fs.readFileSync(path.join(__dirname, '../api/cron.js'), 'utf8');
assert.ok(cron.includes('hubert-seed-intro-followups'), 'cron route registered');

const vercel = fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8');
assert.ok(vercel.includes('/api/cron/hubert-seed-intro-followups'), 'vercel cron scheduled');

const branded = fs.readFileSync(
  path.join(__dirname, '../api/_lib/branded-email-templates.js'),
  'utf8'
);
assert.ok(branded.includes('hubert_intro_reminder'), 'branded template map');

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/345_hubert_intro_reminder_email.sql'),
  'utf8'
);
assert.ok(migration.includes('hubert_intro_reminder'), 'migration inserts template');

(async () => {
  await testReminderQuerySoftSkip();
  await testPauseRequiresReminder();
  console.log('ok — hubert seed intro followups');
})().catch((e) => {
  console.error('FAIL:', e && e.message ? e.message : e);
  process.exit(1);
});
