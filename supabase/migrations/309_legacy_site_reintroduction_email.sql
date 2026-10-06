-- One-off reintroduction for the-networker.co.uk contacts.
-- HTML lives in email-templates/legacy-site-reintroduction.html (branded file wins).

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
  'legacy_site_reintroduction',
  'Old-site reintroduction',
  'Sent again to the-networker.co.uk contacts to introduce The Networker UK, the 6,500 listed events, and a free account.',
  'The Networker UK is live — {{event_count}} events and counting',
  '<p>stub — see email-templates/legacy-site-reintroduction.html</p>',
  array[
    'user_name',
    'event_count',
    'preheader',
    'register_url',
    'cta_url',
    'cta_label',
    'account_prompt',
    'groups_url',
    'browse_events_url',
    'opportunities_url',
    'member_offers_url',
    'legacy_site_url',
    'legacy_logo_url',
    'site_url',
    'logo_footer_url',
    'company_name',
    'company_number',
    'support_email',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'unsubscribe_url'
  ],
  'attendees'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
