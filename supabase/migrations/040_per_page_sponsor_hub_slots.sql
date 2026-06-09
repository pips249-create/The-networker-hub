-- Per-page hero Sponsor Hub slots (events, organisers, opportunities, academy).

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
  v.new_slot,
  b.title,
  b.subtitle,
  b.body,
  b.cta_label,
  b.cta_url,
  b.logo_url,
  b.image_url,
  b.company_name,
  b.active
from public.cms_blocks b
cross join (
  values
    ('events_sponsor_hub'),
    ('organisers_sponsor_hub'),
    ('opportunities_sponsor_hub'),
    ('academy_sponsor_hub')
) as v(new_slot)
where b.slot = 'sponsor_hub'
on conflict (slot) do nothing;

-- Copy CTA colour when migration 039 has been applied.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_blocks'
      and column_name = 'cta_color'
  ) then
    update public.cms_blocks dst
    set cta_color = src.cta_color
    from public.cms_blocks src
    where src.slot = 'sponsor_hub'
      and dst.slot in (
        'events_sponsor_hub',
        'organisers_sponsor_hub',
        'opportunities_sponsor_hub',
        'academy_sponsor_hub'
      )
      and (dst.cta_color is null or dst.cta_color = '');
  end if;
end $$;
