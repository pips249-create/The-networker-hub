-- Optional prospect logo URL on tailored pitch decks (organiser photo or website).

alter table public.custom_pitch_decks
  add column if not exists prospect_logo_url text;

comment on column public.custom_pitch_decks.prospect_logo_url is
  'Prospect logo shown on the deck hero (usually organiser photo_url).';
