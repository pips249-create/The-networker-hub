#!/usr/bin/env node
/**
 * Builds supabase/migrations/063_organiser_new_booking.sql from
 * email-templates/organiser-new-booking.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/organiser-new-booking.html');
const outPath = path.join(root, 'supabase/migrations/063_organiser_new_booking.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Organiser new booking alert email

update public.email_templates
set
  name = 'New booking (organiser)',
  description = 'Notifies the organiser when someone books a ticket for their event.',
  subject = 'New booking: {{attendee_name}} — {{event_name}}',
  body_html = '${escaped}',
  placeholders = array[
    'organiser_name', 'event_name', 'event_date', 'event_time',
    'attendee_name', 'attendee_email', 'attendee_initial',
    'user_name', 'user_email', 'ticket_name', 'amount_paid', 'booking_time',
    'tickets_sold', 'tickets_remaining', 'total_revenue',
    'dashboard_url', 'sponsor_row', 'site_url', 'logo_url',
    'privacy_url', 'terms_url', 'refunds_url', 'contact_url'
  ],
  category = 'events',
  updated_at = now()
where slug = 'organiser_new_registration';
`;

fs.writeFileSync(outPath, sql, 'utf8');
console.log('Wrote', outPath, '(' + Math.round(bodyHtml.length / 1024) + ' KB HTML)');
