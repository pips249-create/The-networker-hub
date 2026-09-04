-- Industry Sponsor cms_blocks rows + payment welcome email.

insert into public.cms_blocks (
  slot,
  title,
  body,
  cta_label,
  cta_url,
  logo_url,
  company_name,
  active,
  include_in_emails
)
select
  'opportunity_industry_sponsor_' || v.slug,
  '',
  '',
  'Find out more',
  'https://',
  null,
  null,
  false,
  false
from (
  values
    ('cleaning'),
    ('home-services'),
    ('food'),
    ('retail'),
    ('tech'),
    ('health'),
    ('medical'),
    ('beauty'),
    ('property'),
    ('automotive'),
    ('education'),
    ('childcare'),
    ('care'),
    ('finance'),
    ('recruitment'),
    ('pets'),
    ('leisure'),
    ('networking')
) as v(slug)
on conflict (slot) do nothing;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'industry_sponsor_payment_welcome',
    'Industry Sponsor payment welcome',
    'Sent after Industry Sponsor Stripe checkout completes — logo and link instructions.',
    'Industry Sponsor confirmed — send your logo & link',
    '<p>stub</p>',
    array['contact_name', 'industry_names', 'advertising_url', 'creative_email', 'monthly_note', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'advertising'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category;
