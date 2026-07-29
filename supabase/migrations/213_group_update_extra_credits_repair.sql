-- Repair: ensure monthly group-update credit column exists
-- (safe to re-run if migration 212 was only partly applied)

alter table public.organisers
  add column if not exists group_update_extra_credits integer not null default 0;

comment on column public.organisers.group_update_extra_credits is
  'Purchased extra monthly group-update sends. Consumed after the free monthly allowance.';
