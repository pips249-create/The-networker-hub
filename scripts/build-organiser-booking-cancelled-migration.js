#!/usr/bin/env node
/**
 * Builds supabase/migrations/067_organiser_cancel_connect.sql from
 * email-templates/organiser-booking-cancelled.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/organiser-booking-cancelled.html');
const outPath = path.join(root, 'supabase/migrations/067_organiser_cancel_connect.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Organiser booking-cancelled alert + Stripe Connect organiser columns

alter table public.organisers
  add column if not exists stripe_charges_enabled boolean default false,
  add column if not exists stripe_payouts_enabled boolean default false,
  add column if not exists stripe_connect_details_submitted boolean default false,
  add column if not exists stripe_connect_onboarded_at timestamptz;

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
  'organiser_booking_cancelled',
  'Booking cancelled (organiser)',
  'Notifies the organiser when an attendee cancels their booking, including refund action when required.',
  'Booking cancelled: {{attendee_name}} — {{event_name}}',
  '${escaped}',
  array[
    'organiser_name', 'event_name', 'event_date', 'event_time',
    'attendee_name', 'attendee_email', 'attendee_initial',
    'ticket_name', 'amount_paid', 'cancellation_time', 'booking_time',
    'refund_action_row', 'dashboard_url', 'sponsor_row',
    'site_url', 'logo_url', 'privacy_url', 'terms_url', 'refunds_url'
  ],
  'events'
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
