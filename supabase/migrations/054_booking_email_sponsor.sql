-- Booking confirmation email sponsor (editable separately; seeded from Events browse sponsor)

insert into public.cms_blocks (
  slot,
  title,
  subtitle,
  body,
  cta_label,
  cta_url,
  logo_url,
  image_url,
  company_name,
  active
)
select
  'booking_email_sponsor',
  b.title,
  b.subtitle,
  b.body,
  coalesce(nullif(trim(b.cta_label), ''), 'Visit website'),
  b.cta_url,
  b.logo_url,
  b.image_url,
  b.company_name,
  b.active
from public.cms_blocks b
where b.slot in ('events_sponsor_hub', 'sponsor_hub')
order by case b.slot when 'events_sponsor_hub' then 0 else 1 end
limit 1
on conflict (slot) do nothing;
