#!/usr/bin/env node
/**
 * Builds a Supabase migration from email-templates/booking-confirmation.html
 *
 * Usage:
 *   node scripts/build-booking-email-migration.js [migrationNumber] [description]
 *
 * Example:
 *   node scripts/build-booking-email-migration.js 061 booking_email_links
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/booking-confirmation.html');

const migrationNumber = String(process.argv[2] || '061').padStart(3, '0');
const migrationSlug = String(process.argv[3] || 'booking_email_links').replace(/[^a-z0-9_]/gi, '_');
const outPath = path.join(root, 'supabase/migrations/' + migrationNumber + '_' + migrationSlug + '.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Booking confirmation email — ${migrationSlug.replace(/_/g, ' ')}

update public.email_templates
set
  subject = 'You''re booked for {{event_name}}',
  body_html = '${escaped}',
  placeholders = array[
    'user_name', 'user_email', 'event_name', 'event_date', 'event_time',
    'event_location', 'event_url', 'ticket_name', 'amount_paid', 'payment_status',
    'registration_id', 'organiser_name', 'meeting_link', 'meeting_type',
    'refund_policy', 'refund_policy_details', 'refund_cutoff_days',
    'booking_reference', 'booked_at', 'ticket_quantity', 'ticket_quantity_label',
    'hub_account_url', 'hub_payment_url', 'browse_events_url', 'contact_url',
    'privacy_url', 'terms_url', 'refunds_url',
    'payment_summary_row', 'event_meta_rows', 'meeting_link_row', 'refund_policy_row', 'sponsor_row',
    'site_url', 'logo_url'
  ],
  updated_at = now()
where slug = 'booking_confirmation';
`;

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Wrote', outPath, '(' + Math.round(bodyHtml.length / 1024) + ' KB HTML)');
