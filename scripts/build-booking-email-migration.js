#!/usr/bin/env node
/**
 * Builds supabase/migrations/050_booking_confirmation_hub_branding.sql from
 * email-templates/booking-confirmation.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/booking-confirmation.html');
const outPath = path.join(
  root,
  'supabase/migrations/058_booking_payment_summary.sql'
);

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Booking confirmation email — payment summary block

update public.email_templates
set
  subject = 'You''re booked for {{event_name}}',
  body_html = '${escaped}',
  placeholders = array[
    'user_name', 'user_email', 'event_name', 'event_date', 'event_time',
    'event_location', 'event_url', 'ticket_name', 'amount_paid', 'organiser_name',
    'meeting_link', 'meeting_type', 'refund_policy', 'refund_policy_details', 'refund_cutoff_days',
    'booking_reference', 'booked_at', 'ticket_quantity', 'ticket_quantity_label', 'hub_account_url',
    'payment_summary_row', 'event_meta_rows', 'meeting_link_row', 'refund_policy_row', 'sponsor_row',
    'site_url', 'logo_url'
  ],
  updated_at = now()
where slug = 'booking_confirmation';
`;

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Wrote', outPath, '(' + Math.round(bodyHtml.length / 1024) + ' KB HTML)');
