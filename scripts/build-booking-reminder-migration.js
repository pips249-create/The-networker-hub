#!/usr/bin/env node
/**
 * Builds a Supabase migration from email-templates/booking-reminder-24hr.html
 *
 * Usage:
 *   node scripts/build-booking-reminder-migration.js [migrationNumber] [description] [--with-schema]
 *
 * Examples:
 *   node scripts/build-booking-reminder-migration.js 060 booking_reminder_24hr --with-schema
 *   node scripts/build-booking-reminder-migration.js 062 booking_reminder_sponsor_fix
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/booking-reminder-24hr.html');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const withSchema = process.argv.includes('--with-schema');
const migrationNumber = String(args[0] || '062').padStart(3, '0');
const migrationSlug = String(args[1] || 'booking_reminder_sponsor_fix').replace(/[^a-z0-9_]/gi, '_');
const outPath = path.join(root, 'supabase/migrations/' + migrationNumber + '_' + migrationSlug + '.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const schemaSql = `-- 24-hour event reminder email + reminder tracking on registrations

alter table public.registrations
  add column if not exists reminder_email_sent_at timestamptz;

comment on column public.registrations.reminder_email_sent_at is
  'When the 24-hour booking reminder email was sent to the attendee.';

`;

const updateSql = `update public.email_templates
set
  name = '24-hour event reminder',
  description = 'Sent to attendees 24 hours before their event starts.',
  subject = 'Your event is tomorrow – {{event_name}}',
  body_html = '${escaped}',
  placeholders = array[
    'user_name', 'user_email', 'event_name', 'event_date', 'event_time',
    'event_location', 'event_url', 'ticket_name', 'organiser_name',
    'meeting_link', 'meeting_type', 'meeting_link_row', 'sponsor_row', 'site_url', 'logo_url'
  ],
  category = 'events',
  updated_at = now()
where slug = 'booking_reminder';
`;

const sql =
  '-- Booking reminder email — ' +
  migrationSlug.replace(/_/g, ' ') +
  '\n\n' +
  (withSchema ? schemaSql : '') +
  updateSql;

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Wrote', outPath, '(' + Math.round(bodyHtml.length / 1024) + ' KB HTML)');
