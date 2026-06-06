-- Align Sponsor Hub cms_blocks columns and refresh active_cms_blocks view.

alter table public.cms_blocks
  add column if not exists logo_url text,
  add column if not exists company_name text,
  add column if not exists subtitle text,
  add column if not exists image_url text;

update public.cms_blocks
set subtitle = coalesce(nullif(trim(subtitle), ''), nullif(trim(title), ''))
where slot = 'sponsor_hub'
  and coalesce(trim(subtitle), '') = ''
  and coalesce(trim(title), '') <> '';

update public.cms_blocks
set title = coalesce(nullif(trim(title), ''), nullif(trim(subtitle), ''))
where slot = 'sponsor_hub'
  and coalesce(trim(title), '') = ''
  and coalesce(trim(subtitle), '') <> '';

update public.cms_blocks
set logo_url = coalesce(nullif(trim(logo_url), ''), nullif(trim(image_url), '')),
    image_url = coalesce(nullif(trim(image_url), ''), nullif(trim(logo_url), ''))
where slot = 'sponsor_hub';

drop view if exists public.active_cms_blocks;

create view public.active_cms_blocks as
select *
from public.cms_blocks
where active = true;

grant select on public.active_cms_blocks to anon, authenticated, service_role;
grant insert, update, delete on public.cms_blocks to service_role;
