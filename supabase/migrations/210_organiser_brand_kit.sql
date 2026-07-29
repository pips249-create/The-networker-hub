-- Brand kit colours for organiser LinkedIn posts and profile branding.

alter table public.organisers
  add column if not exists brand_primary_color text,
  add column if not exists brand_secondary_color text,
  add column if not exists brand_accent_color text;

comment on column public.organisers.brand_primary_color is
  'Hex brand primary colour (e.g. #0d1f3c) used for LinkedIn post graphics.';
comment on column public.organisers.brand_secondary_color is
  'Hex brand secondary / background colour.';
comment on column public.organisers.brand_accent_color is
  'Hex brand accent colour for highlights on post graphics.';
