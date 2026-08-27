-- Split Affiliate from Partnership: allow affiliate as a listing type,
-- and remap legacy commission-only partnerships to affiliate.

alter table public.business_opportunities
  drop constraint if exists business_opportunities_type_check;

alter table public.business_opportunities
  add constraint business_opportunities_type_check
  check (type in (
    'franchise',
    'side-hustle',
    'partnership',
    'affiliate',
    'networking',
    'distributorship',
    'business-opportunity',
    'network-marketing'
  ));

comment on column public.business_opportunities.type is
  'Listing type. affiliate = commission programmes; partnership = business partnership / JV; network-marketing = product-selling only.';

-- Legacy rows: partnership + Commission meta + no meaningful Investment → affiliate
update public.business_opportunities bo
set
  type = 'affiliate',
  tags = (
    select coalesce(
      array_agg(distinct case when lower(t) = 'partnership' then 'affiliate' else t end),
      array['affiliate']::text[]
    )
    from unnest(
      case
        when bo.tags is null or cardinality(bo.tags) = 0 then array['partnership']::text[]
        else bo.tags
      end
    ) as t
  )
where bo.type = 'partnership'
  and exists (
    select 1
    from jsonb_array_elements(coalesce(bo.meta, '[]'::jsonb)) el
    where lower(coalesce(el->>'key', '')) = 'commission'
      and nullif(trim(coalesce(el->>'val', '')), '') is not null
  )
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(bo.meta, '[]'::jsonb)) el
    where lower(coalesce(el->>'key', '')) = 'investment'
      and nullif(trim(coalesce(el->>'val', '')), '') is not null
      and lower(trim(el->>'val')) !~ '^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable|on request|0|£0|£0\.00)$'
      and trim(el->>'val') ~ '[1-9]'
  );
