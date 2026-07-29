-- Type style for LinkedIn post graphics (curated pairings, not scraped website fonts).

alter table public.organisers
  add column if not exists brand_type_style text;

comment on column public.organisers.brand_type_style is
  'Curated LinkedIn post type style: classic | editorial | modern | bold | friendly.';
