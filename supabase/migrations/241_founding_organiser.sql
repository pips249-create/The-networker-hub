-- Founding Organiser cohort (Email 2 / soft launch).
-- Badge: all groups claimed before 1 Sept 2026.
-- Homepage showcase: first 50 claims, shown through end of Nov 2026 (~3 months from launch).

alter table public.organisers
  add column if not exists founding_organiser_at timestamptz,
  add column if not exists founding_homepage_until timestamptz;

comment on column public.organisers.founding_organiser_at is
  'When this group earned Founding Organiser status (claim before soft launch).';

comment on column public.organisers.founding_homepage_until is
  'If set, group may appear in the homepage Founding Organisers strip until this time (first 50 claims).';

create index if not exists idx_organisers_founding_organiser
  on public.organisers(founding_organiser_at)
  where founding_organiser_at is not null;

create index if not exists idx_organisers_founding_homepage
  on public.organisers(founding_homepage_until, ownership_claimed_at)
  where founding_homepage_until is not null;
