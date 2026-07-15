-- City Partner slots for /networking/:region intro placements (logo + CTA, no emails).

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
  'networking_city_partner_' || v.slug,
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
    ('central-london'),
    ('north-london'),
    ('south-london'),
    ('east-london'),
    ('west-london'),
    ('manchester'),
    ('birmingham'),
    ('glasgow'),
    ('edinburgh'),
    ('leeds'),
    ('liverpool'),
    ('newcastle'),
    ('bristol'),
    ('sheffield'),
    ('nottingham'),
    ('cardiff'),
    ('brighton'),
    ('cambridge'),
    ('oxford'),
    ('chester')
) as v(slug)
on conflict (slot) do nothing;

comment on column public.cms_blocks.include_in_emails is
  'When false, sponsor creative is website-only (e.g. City Partner placements).';
