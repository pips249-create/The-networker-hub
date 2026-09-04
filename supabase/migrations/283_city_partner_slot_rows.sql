-- Ensure every City Partner region has a cms_blocks row.
-- Missing rows made Stripe payment succeed while UPDATE reservation no-op'd
-- (seen for Chester and most other cities that were never seeded or were deleted).

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
    ('chester'),
    ('belfast'),
    ('reading'),
    ('leicester'),
    ('bournemouth')
) as v(slug)
on conflict (slot) do nothing;
