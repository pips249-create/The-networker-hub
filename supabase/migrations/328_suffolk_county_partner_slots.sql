-- County Sponsor slots for Suffolk (Events + Opportunities).

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
  v.slot,
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
    ('networking_county_partner_suffolk'),
    ('opportunity_county_sponsor_suffolk')
) as v(slot)
where not exists (
  select 1
  from public.cms_blocks
  where slot = v.slot
);
