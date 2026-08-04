-- Opportunity detail pages — 3-slot mini sponsor carousel (Page Partner package).
-- Aligns with event/organiser page carousels and the advertising “3 rotation slots” copy.
insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'opportunity_page_carousel_ads',
  'Opportunity page carousel ads',
  '{"ads":[{"id":"opportunity_carousel_1","slot_index":0,"active":false},{"id":"opportunity_carousel_2","slot_index":1,"active":false},{"id":"opportunity_carousel_3","slot_index":2,"active":false}]}',
  'Enquire now',
  'mailto:rosie@thenetworkerhub.com?subject=Opportunity%20Page%20Partner%20enquiry',
  true
)
on conflict (slot) do nothing;

-- Organiser page carousel was seeded inactive; enable so configured logos can render.
update public.cms_blocks
set active = true,
    updated_at = now()
where slot = 'organiser_page_carousel_ads'
  and active = false;

-- Seed opportunity carousel slot 0 from the legacy single sidebar ad when present.
update public.cms_blocks as carousel
set
  body = jsonb_build_object(
    'ads',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'opportunity_carousel_1',
        'slot_index', 0,
        'company_name', coalesce(nullif(trim(legacy.company_name), ''), ''),
        'logo_url', coalesce(nullif(trim(coalesce(legacy.logo_url, legacy.image_url)), ''), ''),
        'cta_url', coalesce(nullif(trim(legacy.cta_url), ''), ''),
        'cta_label', coalesce(nullif(trim(legacy.cta_label), ''), 'Enquire now'),
        'cta_color', coalesce(nullif(trim(legacy.cta_color), ''), ''),
        'active', true
      ),
      jsonb_build_object('id', 'opportunity_carousel_2', 'slot_index', 1, 'active', false),
      jsonb_build_object('id', 'opportunity_carousel_3', 'slot_index', 2, 'active', false)
    )
  )::text,
  active = true,
  updated_at = now()
from public.cms_blocks as legacy
where carousel.slot = 'opportunity_page_carousel_ads'
  and legacy.slot = 'opportunity_page_sidebar_ad'
  and legacy.active is not false
  and (
    coalesce(nullif(trim(coalesce(legacy.logo_url, legacy.image_url)), ''), '') <> ''
    and coalesce(nullif(trim(legacy.cta_url), ''), '') ~* '^(https?:|mailto:)'
  )
  and (
    carousel.body is null
    or carousel.body = ''
    or carousel.body::jsonb -> 'ads' -> 0 ->> 'logo_url' is null
    or coalesce(nullif(trim(carousel.body::jsonb -> 'ads' -> 0 ->> 'logo_url'), ''), '') = ''
  );
