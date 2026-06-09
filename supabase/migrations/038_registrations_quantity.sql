-- Ticket quantity per registration (multi-ticket checkout)
alter table public.registrations
  add column if not exists quantity integer not null default 1;

alter table public.registrations
  drop constraint if exists registrations_quantity_check;

alter table public.registrations
  add constraint registrations_quantity_check check (quantity >= 1);

comment on column public.registrations.quantity is 'Number of tickets in this booking (one registration row per checkout)';
