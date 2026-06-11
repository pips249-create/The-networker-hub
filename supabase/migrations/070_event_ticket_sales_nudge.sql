-- List events on the browse page before ticket sales are enabled; nudge organisers by email.

alter table public.events
  add column if not exists ticket_sales_enabled boolean not null default false;

comment on column public.events.ticket_sales_enabled is
  'When false, the event is visible on the hub but buyers cannot purchase until the organiser enables sales.';

-- Keep current live events purchasable
update public.events
set ticket_sales_enabled = true
where status = 'published'
  and approval_status = 'Approved';

create table if not exists public.event_ticket_sales_nudges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid references public.events(id) on delete cascade,
  organiser_id uuid references public.organisers(id) on delete set null,
  nudger_email text not null,
  nudger_name text,
  message text
);

create index if not exists idx_event_ticket_sales_nudges_event_email_created
  on public.event_ticket_sales_nudges(event_id, nudger_email, created_at desc);

comment on table public.event_ticket_sales_nudges is
  'Visitor asked an organiser to turn on ticket sales for a listed event.';

alter table public.event_ticket_sales_nudges enable row level security;
