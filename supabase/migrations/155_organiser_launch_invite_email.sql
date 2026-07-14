-- September launch invitation for UK networking organisers (bulk campaign).

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
  'organiser_launch_invite',
  'Organiser confirm page (Email 2)',
  'Follow-up after rebrand announcement — create password, confirm organiser page, add events.',
  'Confirm your organiser page — The Networker Hub',
  '<p>stub — see email-templates/organiser-launch-invite.html</p>',
  array[
    'organiser_name',
    'claim_url',
    'site_url',
    'legacy_site_url',
    'company_name',
    'company_number',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'contact_url',
    'sponsor_row'
  ],
  'organisers'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
