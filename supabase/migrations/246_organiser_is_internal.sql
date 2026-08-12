-- Mark organiser accounts as internal/test so they are excluded from public-facing strips.
alter table public.organisers
  add column if not exists is_internal boolean not null default false;

comment on column public.organisers.is_internal is
  'True for internal test or staff accounts that should not appear in public strips (founding organisers, partner logos, etc.).';

create index if not exists idx_organisers_is_internal
  on public.organisers(is_internal)
  where is_internal = true;
