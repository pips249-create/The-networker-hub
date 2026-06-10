#!/usr/bin/env node
/**
 * Builds supabase/migrations/066_cancellation_refund_emails.sql from
 * email-templates/booking-cancelled.html, event-cancelled.html, refund-processed.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'supabase/migrations/066_cancellation_refund_emails.sql');

const templates = [
  {
    file: 'booking-cancelled.html',
    slug: 'booking_cancelled',
    name: 'Booking cancelled',
    description: 'Sent when an attendee cancels their own booking.',
    subject: 'Booking cancelled – {{event_name}}',
    placeholders: [
      'user_name', 'user_email', 'event_name', 'event_date', 'event_time',
      'ticket_name', 'amount_paid', 'organiser_name', 'refund_status',
      'refund_eligible_row', 'no_refund_row', 'sponsor_row',
      'site_url', 'logo_url',
    ],
  },
  {
    file: 'event-cancelled.html',
    slug: 'event_cancelled',
    name: 'Event cancelled',
    description: 'Sent to all booked attendees when an organiser cancels an event.',
    subject: 'Event cancelled – {{event_name}}',
    placeholders: [
      'user_name', 'user_email', 'event_name', 'event_date', 'event_time',
      'ticket_name', 'amount_paid', 'organiser_name',
      'refund_headline', 'refund_details', 'organiser_message_row', 'sponsor_row',
      'site_url', 'logo_url',
    ],
  },
  {
    file: 'refund-processed.html',
    slug: 'refund_processed',
    name: 'Refund processed',
    description: 'Sent when a refund has been issued to the attendee.',
    subject: 'Your refund is on its way – {{event_name}}',
    placeholders: [
      'user_name', 'user_email', 'event_name', 'ticket_name',
      'refund_amount', 'refund_date', 'sponsor_row', 'site_url', 'logo_url',
    ],
  },
];

function sqlString(text) {
  return String(text || '').replace(/'/g, "''");
}

const inserts = templates.map(function (tpl) {
  const bodyHtml = fs.readFileSync(path.join(root, 'email-templates', tpl.file), 'utf8');
  const placeholdersSql =
    'array[' + tpl.placeholders.map((p) => "'" + p + "'").join(', ') + ']';
  return (
    "insert into public.email_templates (\n" +
    "  slug, name, description, subject, body_html, placeholders, category\n" +
    ")\n" +
    'values (\n' +
    "  '" +
    tpl.slug +
    "',\n" +
    "  '" +
    sqlString(tpl.name) +
    "',\n" +
    "  '" +
    sqlString(tpl.description) +
    "',\n" +
    "  '" +
    sqlString(tpl.subject) +
    "',\n" +
    "  '" +
    sqlString(bodyHtml) +
    "',\n" +
    '  ' +
    placeholdersSql +
    ",\n" +
    "  'attendees'\n" +
    ')\n' +
    'on conflict (slug) do update set\n' +
    '  name = excluded.name,\n' +
    '  description = excluded.description,\n' +
    '  subject = excluded.subject,\n' +
    '  body_html = excluded.body_html,\n' +
    '  placeholders = excluded.placeholders,\n' +
    '  category = excluded.category,\n' +
    '  updated_at = now();'
  );
});

const sql =
  '-- Attendee cancellation & refund emails\n\n' +
  "update public.email_templates\n" +
  "set category = 'attendees'\n" +
  "where slug in ('booking_cancelled', 'event_cancelled', 'refund_processed');\n\n" +
  'alter table public.registrations\n' +
  '  add column if not exists cancelled_at timestamptz,\n' +
  '  add column if not exists cancellation_email_sent_at timestamptz,\n' +
  '  add column if not exists event_cancelled_email_sent_at timestamptz,\n' +
  '  add column if not exists refund_email_sent_at timestamptz;\n\n' +
  "comment on column public.registrations.cancelled_at is 'When the attendee or organiser cancelled this registration.';\n" +
  "comment on column public.registrations.cancellation_email_sent_at is 'Booking-cancelled email sent at.';\n" +
  "comment on column public.registrations.event_cancelled_email_sent_at is 'Event-cancelled email sent at.';\n" +
  "comment on column public.registrations.refund_email_sent_at is 'Refund-processed email sent at.';\n\n" +
  inserts.join('\n\n');

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Wrote', outPath);
