-- Deck kind + selected sponsorship placements for tailored pitch decks.

alter table public.custom_pitch_decks
  add column if not exists deck_type text not null default 'organiser';

alter table public.custom_pitch_decks
  add column if not exists sponsorship_placements text[] not null default '{}';

alter table public.custom_pitch_decks
  drop constraint if exists custom_pitch_decks_deck_type_check;

alter table public.custom_pitch_decks
  add constraint custom_pitch_decks_deck_type_check
  check (deck_type in ('organiser', 'sponsorship', 'combined'));

comment on column public.custom_pitch_decks.deck_type is
  'organiser = group onboarding pitch; sponsorship = /advertising placements; combined = both.';

comment on column public.custom_pitch_decks.sponsorship_placements is
  'Keys from sponsorship pitch catalog (Headline Sponsor, directory listing, etc.).';
