-- Referral partner invite email (Command Centre create + Email invite).
-- Body is served from email-templates/partner-programme-invite.html via branded file fallback.

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
  'partner_programme_invite',
  'Partner programme invite',
  'Sent when a referral partner is created in Command Centre (or Email invite is clicked) — partner code, T&Cs accept link, workspace links, and badge attachment.',
  'Your Networker UK partner workspace · code {{partner_code}}',
  '<p>stub — see email-templates/partner-programme-invite.html</p>',
  array[
    'partner_code',
    'partner_name',
    'partner_first_name',
    'home_url',
    'ads_url',
    'opp_url',
    'hub_url',
    'accept_terms_url',
    'terms_url',
    'support_email',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'refunds_url',
    'contact_url',
    'sponsor_row',
    'unsubscribe_url'
  ],
  'advertising'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
