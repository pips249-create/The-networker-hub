-- Opportunities County Sponsor slots, including the newer county hubs.
-- Without these rows, admin placement and checkout reservation can no-op.

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
  'opportunity_county_sponsor_' || v.slug,
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
    ('devon'),
    ('dorset'),
    ('essex'),
    ('hampshire'),
    ('hertfordshire'),
    ('kent'),
    ('lancashire'),
    ('norfolk'),
    ('oxfordshire'),
    ('shropshire'),
    ('staffordshire'),
    ('surrey'),
    ('sussex'),
    ('warwickshire'),
    ('yorkshire')
) as v(slug)
where not exists (
  select 1
  from public.cms_blocks
  where slot = 'opportunity_county_sponsor_' || v.slug
);
