-- Manual override for sponsor logo band background (light logos on light cards).

alter table public.cms_blocks
  add column if not exists logo_band_dark boolean not null default false;

drop view if exists public.active_cms_blocks;

create view public.active_cms_blocks as
select *
from public.cms_blocks
where active = true;

grant select on public.active_cms_blocks to anon, authenticated, service_role;
