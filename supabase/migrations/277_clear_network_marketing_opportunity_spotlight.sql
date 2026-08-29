-- Drop Premium Spotlight from network-marketing listings (carousel never shows them).
-- Frees slots so Command Centre used-count matches /opportunities/ carousel.

update public.business_opportunities
set
  featured = false,
  featured_until = null,
  updated_at = now()
where featured = true
  and (
    lower(trim(coalesce(type, ''))) = 'network-marketing'
    or exists (
      select 1
      from unnest(coalesce(tags, array[]::text[])) as t(tag)
      where lower(trim(coalesce(t.tag, ''))) = 'network-marketing'
    )
  );
