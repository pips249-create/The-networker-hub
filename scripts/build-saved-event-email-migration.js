#!/usr/bin/env node
/**
 * Builds supabase/migrations/065_saved_event_tickets_open.sql from
 * email-templates/saved-event-tickets-open.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/saved-event-tickets-open.html');
const outPath = path.join(root, 'supabase/migrations/065_saved_event_tickets_open.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Saved event — tickets on sale notification email

insert into public.email_templates (
  slug,
  name,
  description,
  subject,
  body_html,
  placeholders,
  category
)
values (
  'saved_event_tickets_open',
  'Saved event — tickets on sale',
  'Sent when ticket sales open for an event the attendee saved.',
  'Tickets are on sale for {{event_name}}',
  '${escaped}',
  array[
    'user_name', 'user_email', 'event_name', 'event_date', 'event_time', 'event_location', 'event_url',
    'hub_account_url', 'browse_events_url', 'contact_url', 'privacy_url', 'terms_url', 'refunds_url',
    'sponsor_row', 'site_url', 'logo_url'
  ],
  'attendees'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
`;

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Wrote', outPath, '(' + Math.round(bodyHtml.length / 1024) + ' KB HTML)');
