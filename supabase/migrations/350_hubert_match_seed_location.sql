-- Seed contacts: location + country for TINA geo matching, company page for ops.
alter table public.hubert_match_seed
  add column if not exists location text;

alter table public.hubert_match_seed
  add column if not exists country text;

alter table public.hubert_match_seed
  add column if not exists website_url text;

comment on column public.hubert_match_seed.location is
  'Town/city/region for Matchmaker geo scoring. Not shown with a personal name on shortlist cards.';

comment on column public.hubert_match_seed.country is
  'Country for Matchmaker geo scoring (e.g. United Kingdom, South Africa).';

comment on column public.hubert_match_seed.website_url is
  'Company website / page URL for ops research. Not shown on public shortlist cards.';
