-- Public organiser profile URLs (/organisers/:slug)

alter table public.organisers
  add column if not exists slug text;

create unique index if not exists organisers_slug_unique_idx
  on public.organisers (slug)
  where slug is not null and slug <> '';

with candidates as (
  select
    id,
    trim(both '-' from lower(
      regexp_replace(
        regexp_replace(coalesce(nullif(trim(name), ''), 'organiser'), '[^a-zA-Z0-9]+', '-', 'g'),
        '-+',
        '-',
        'g'
      )
    )) as base_slug
  from public.organisers
  where slug is null
    or slug = ''
    or slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
numbered as (
  select
    id,
    case
      when row_number() over (partition by base_slug order by id) = 1 then left(base_slug, 80)
      else left(base_slug, 72) || '-' || row_number() over (partition by base_slug order by id)::text
    end as new_slug
  from candidates
  where base_slug <> ''
)
update public.organisers o
set slug = n.new_slug
from numbered n
where o.id = n.id;
