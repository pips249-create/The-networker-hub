-- Track last profile change for Command Centre → Fix listings sort order.

alter table public.organisers
  add column if not exists updated_at timestamptz;

update public.organisers
set updated_at = coalesce(ownership_claimed_at, created_at, now())
where updated_at is null;

alter table public.organisers
  alter column updated_at set default now(),
  alter column updated_at set not null;

comment on column public.organisers.updated_at is
  'Last time this organiser profile row changed (auto-maintained on update).';

create or replace function public.organisers_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organisers_touch_updated_at on public.organisers;
create trigger organisers_touch_updated_at
  before update on public.organisers
  for each row
  execute function public.organisers_touch_updated_at();
