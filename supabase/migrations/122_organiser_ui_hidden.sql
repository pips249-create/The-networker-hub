-- Allow users to hide organiser workspace in nav while keeping data/access intact.

alter table public.hub_accounts
  add column if not exists organiser_ui_hidden_at timestamptz;

comment on column public.hub_accounts.organiser_ui_hidden_at is
  'When set, hide organiser nav/toggle — user prefers attendee-only UI. Cleared when they re-enable organiser workspace.';
