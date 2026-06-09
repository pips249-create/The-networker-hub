-- Home page partners & sponsors (managed in Command Centre → Sponsorship & ads)

insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'home_partners',
  'Home page partners',
  '{"partners":[]}',
  'Visit',
  'https://',
  true
)
on conflict (slot) do nothing;
