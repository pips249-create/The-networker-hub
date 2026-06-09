-- Sponsor ad CTA button colour (hex), editable from Command Centre.

alter table public.cms_blocks
  add column if not exists cta_color text;

drop view if exists public.active_cms_blocks;

create view public.active_cms_blocks as
select *
from public.cms_blocks
where active = true;

grant select on public.active_cms_blocks to anon, authenticated, service_role;
