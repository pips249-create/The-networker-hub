-- Admin note when a group profile is hidden from the public organiser directory.

alter table public.organisers
  add column if not exists hide_from_browse_reason text;

comment on column public.organisers.hide_from_browse_reason is
  'Internal admin reason for listing_status = unpublished (e.g. requested removal — Name). Cleared when published again.';
