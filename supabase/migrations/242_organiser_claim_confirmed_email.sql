-- Post-claim confirmation: founding badge + logo/website CTA.

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
  'organiser_claim_confirmed',
  'Organiser claim confirmed',
  'Sent after an organiser confirms their page — founding badge notice and CTA to add logo/website.',
  'You''re a Founding Organiser · 2026 — {{group_name}}',
  '<p>stub — see email-templates/organiser-claim-confirmed.html</p>',
  array[
    'user_name',
    'group_name',
    'eyebrow_label',
    'hero_title',
    'intro_line',
    'founding_perk_row',
    'profile_url',
    'profile_edit_url',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'support_email',
    'sponsor_row',
    'mini_sponsors_row',
    'unsubscribe_url'
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
