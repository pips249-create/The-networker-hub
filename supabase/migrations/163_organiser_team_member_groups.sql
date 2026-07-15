-- Per-group access for organiser team editors (owner assigns which groups each editor can manage).

create table if not exists public.organiser_team_member_groups (
  team_member_id  uuid not null references public.organiser_team_members(id) on delete cascade,
  organiser_id    uuid not null references public.organisers(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (team_member_id, organiser_id)
);

create index if not exists organiser_team_member_groups_organiser_idx
  on public.organiser_team_member_groups(organiser_id);

grant select, insert, update, delete on public.organiser_team_member_groups to service_role;

alter table public.organiser_team_member_groups enable row level security;

revoke all on table public.organiser_team_member_groups from anon, authenticated;
