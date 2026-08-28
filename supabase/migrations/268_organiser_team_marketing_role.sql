-- Marketing role: Promote tools only (no revenue, registrations, or event admin).

alter table public.organiser_team_members
  drop constraint if exists organiser_team_members_role_check;

alter table public.organiser_team_members
  add constraint organiser_team_members_role_check
  check (role in ('owner', 'editor', 'marketing'));
