-- County Sponsor slots for Devon, Dorset, Norfolk, Staffordshire, Warwickshire and Yorkshire.

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
    ('devon'),
    ('dorset'),
    ('norfolk'),
    ('staffordshire'),
    ('warwickshire'),
    ('yorkshire')
) as v(slug)
where not exists (
  select 1
  from public.cms_blocks
  where slot = 'networking_county_partner_' || v.slug
);
