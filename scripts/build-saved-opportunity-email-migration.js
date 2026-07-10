#!/usr/bin/env node
/**
 * Builds supabase/migrations/145_saved_opportunity_closing_email.sql from
 * email-templates/saved-opportunity-closing-soon.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'email-templates/saved-opportunity-closing-soon.html');
const outPath = path.join(root, 'supabase/migrations/145_saved_opportunity_closing_email.sql');

const bodyHtml = fs.readFileSync(templatePath, 'utf8');
const escaped = bodyHtml.replace(/'/g, "''");

const sql = `-- Saved opportunity — listing closing soon notification email

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
  'saved_opportunity_closing_soon',
  'Saved opportunity — closing soon',
  'Sent when a saved business opportunity listing is nearing its expiry date.',
  'An opportunity you saved is closing soon — {{opportunity_title}}',
  '${escaped}',
  array[
    'user_name', 'user_email', 'opportunity_title', 'opportunity_host', 'expiry_date',
    'opportunity_url', 'hub_account_url', 'browse_opportunities_url',
    'contact_url', 'privacy_url', 'terms_url', 'refunds_url',
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
