-- Industry / category on membership list (Category Exclusivity organisers).
alter table public.organiser_member_roster
  add column if not exists industry text;

comment on column public.organiser_member_roster.industry is
  'Member industry/category for Category Exclusivity — set by the organiser on the membership list.';
