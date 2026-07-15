-- Remove ticket access codes / hidden visibility; keep public + members_only only.

-- Convert any remaining hidden tiers to public before tightening the constraint.
update public.tickets
set visibility = 'public'
where visibility = 'hidden';

alter table public.tickets
  drop constraint if exists tickets_visibility_check;

alter table public.tickets
  add constraint tickets_visibility_check
  check (visibility in ('public', 'members_only'));

comment on column public.tickets.visibility is
  'public = shown on the event page; members_only = roster members when signed in.';

-- Drop registration FK before removing the access-codes table.
alter table public.registrations
  drop column if exists access_code_id;

drop table if exists public.ticket_access_codes;
