-- Seed County Sponsor cms_blocks rows for self-serve checkout.
-- Without these rows, Stripe payment can succeed while UPDATE reservation no-ops.

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
  'networking_county_partner_' || v.slug,
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
    ('berkshire'),
    ('buckinghamshire'),
    ('cambridgeshire'),
    ('cheshire'),
    ('essex'),
    ('hampshire'),
    ('hertfordshire'),
    ('kent'),
    ('lancashire'),
    ('oxfordshire'),
    ('surrey'),
    ('sussex')
) as v(slug)
on conflict (slot) do nothing;
