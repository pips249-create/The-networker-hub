-- Persist online meeting platform (Zoom, Teams, etc.) for organiser edit prefill.
alter table public.events
  add column if not exists meeting_platform text;

comment on column public.events.meeting_platform is
  'Online meeting platform label (e.g. Zoom Meeting, Microsoft Teams).';
