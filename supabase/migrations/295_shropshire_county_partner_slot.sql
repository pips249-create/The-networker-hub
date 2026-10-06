-- County Sponsor slot for Shropshire, matching 284_county_partner_slot_rows.sql.

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
  'networking_county_partner_shropshire',
  '',
  '',
  'Find out more',
  'https://',
  null,
  null,
  false,
  false
where not exists (
  select 1
  from public.cms_blocks
  where slot = 'networking_county_partner_shropshire'
);
