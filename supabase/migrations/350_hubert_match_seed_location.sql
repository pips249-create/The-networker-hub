-- Seed contacts need a location for TINA geo matching (city / region asks).
alter table public.hubert_match_seed
  add column if not exists location text;

comment on column public.hubert_match_seed.location is
  'Town/city/region for Matchmaker geo scoring. Not shown with a personal name on shortlist cards.';
