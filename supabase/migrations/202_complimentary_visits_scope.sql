-- Optional shared complimentary guest visits across an organiser's pages.
-- per_group (default): allowance counted per organiser page.
-- across_groups: allowance shared across sibling pages (same account / owner email).

alter table public.organisers
  add column if not exists complimentary_visits_scope text not null default 'per_group';

alter table public.organisers
  drop constraint if exists organisers_complimentary_visits_scope_check;

alter table public.organisers
  add constraint organisers_complimentary_visits_scope_check
  check (complimentary_visits_scope in ('per_group', 'across_groups'));

comment on column public.organisers.complimentary_visits_scope is
  'per_group: complimentary visits counted per organiser page. across_groups: shared across all pages owned by the same organiser account or owner email.';
