-- Pretty public URLs for business opportunities (/opportunities/:slug).

alter table public.business_opportunities
  add column if not exists slug text;

create unique index if not exists business_opportunities_slug_key
  on public.business_opportunities (slug)
  where slug is not null and slug <> '';

comment on column public.business_opportunities.slug is
  'URL slug for public opportunity pages (/opportunities/:slug).';

-- Backfill slugs from titles (append -2, -3, … on collision).
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in
    select id, title
    from public.business_opportunities
    where slug is null or trim(slug) = ''
    order by created_at asc
  loop
    base_slug := left(
      trim(both '-' from regexp_replace(lower(trim(coalesce(r.title, ''))), '[^a-z0-9]+', '-', 'g')),
      96
    );
    if base_slug = '' then
      base_slug := 'opportunity';
    end if;
    candidate := base_slug;
    n := 2;
    while exists (
      select 1 from public.business_opportunities o where o.slug = candidate and o.id <> r.id
    ) loop
      candidate := base_slug || '-' || n;
      n := n + 1;
    end loop;
    update public.business_opportunities set slug = candidate where id = r.id;
  end loop;
end $$;
