-- Optional promo / note on Link Out and Connected booking panels (e.g. discount codes).

alter table public.events
  add column if not exists external_booking_note text;

comment on column public.events.external_booking_note is
  'Optional short note shown on the hub booking panel for Link Out / Connected (e.g. promo code).';
