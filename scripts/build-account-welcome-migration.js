#!/usr/bin/env node
/**
 * Builds supabase/migrations/064_account_welcome_email.sql from
 * email-templates/account-welcome.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/account-welcome.html');
const outPath = path.join(root, 'supabase/migrations/064_account_welcome_email.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Account welcome email + Command Centre attendee/organiser grouping

comment on column public.email_templates.category is
  'Command Centre grouping: attendees, organisers, opportunities, academy';

update public.email_templates
set category = 'attendees'
where slug in ('booking_confirmation', 'booking_reminder', 'account_welcome');

update public.email_templates
set category = 'organisers'
where slug in ('organiser_new_registration', 'organiser_claim_invite');

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
  'account_welcome',
  'Account welcome',
  'Sent when someone creates a new Hub account.',
  'Welcome to The Networker UK, {{user_name}}',
  '${escaped}',
  array[
    'user_name', 'user_email', 'hub_account_url', 'browse_events_url', 'opportunities_url', 'welcome_url',
    'contact_url', 'privacy_url', 'terms_url', 'refunds_url',
    'site_url', 'logo_url', 'logo_footer_url', 'support_email'
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
