-- Command Centre: allocate free Connected booking or Link Out on organiser_accounts.
-- Also adds checkout_mode external_link for redirect-only listings (no webhook sync).

alter table public.organiser_accounts
  add column if not exists connected_booking_granted_at timestamptz,
  add column if not exists connected_booking_granted_by text,
  add column if not exists connected_booking_grant_note text,
  add column if not exists link_out_granted_at timestamptz,
  add column if not exists link_out_granted_by text,
  add column if not exists link_out_grant_note text;

comment on column public.organiser_accounts.connected_booking_granted_at is
  'When Command Centre allocated complimentary Connected booking (no Stripe).';
comment on column public.organiser_accounts.link_out_granted_at is
  'When Command Centre allocated free Link Out (redirect-only, no webhook).';

alter table public.events drop constraint if exists events_checkout_mode_check;

alter table public.events
  add constraint events_checkout_mode_check
  check (checkout_mode in ('hub', 'external_connected', 'external_link'));

comment on column public.events.checkout_mode is
  'hub = platform tickets; external_connected = redirect + webhook sync; external_link = redirect only (Link Out).';

-- Keep browse min price working for Link Out the same way as Connected.
create or replace function public.event_min_ticket_price_value(target_event_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select min(coalesce(t.price, 0))::numeric
      from public.tickets t
      where t.event_id = target_event_id
        and coalesce(t.visibility, 'public') = 'public'
        and coalesce(t.ticket_type, '') <> 'Alumni'
    ),
    (
      select public.external_price_label_to_min(e.external_price_label)
      from public.events e
      where e.id = target_event_id
        and (
          e.checkout_mode in ('external_connected', 'external_link')
          or (
            coalesce(trim(e.external_booking_url), '') <> ''
            and coalesce(trim(e.external_price_label), '') <> ''
          )
        )
    )
  );
$$;
