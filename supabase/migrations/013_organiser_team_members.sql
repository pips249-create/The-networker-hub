-- Organiser team members (invite editors to manage events)

create table if not exists public.organiser_team_members (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz not null default now(),
  organiser_account_id  uuid not null references public.organiser_accounts(id) on delete cascade,
  email                 text not null,
  supabase_user_id      uuid references auth.users(id) on delete set null,
  role                  text not null default 'editor'
    check (role in ('owner', 'editor')),
  status                text not null default 'pending'
    check (status in ('pending', 'active', 'removed')),
  invited_at            timestamptz,
  unique (organiser_account_id, email)
);

create index if not exists organiser_team_members_account_idx
  on public.organiser_team_members(organiser_account_id);

create index if not exists organiser_team_members_email_idx
  on public.organiser_team_members(email);

grant select, insert, update, delete on public.organiser_team_members to service_role;

alter table public.organiser_team_members enable row level security;
