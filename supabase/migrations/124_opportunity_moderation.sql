-- Opportunity moderation: rejection notes + report listing support

alter table public.business_opportunities
  add column if not exists rejection_note text;

comment on column public.business_opportunities.rejection_note is
  'Latest admin or automated rejection reason shown in rejection email.';

alter table public.listing_reports
  add column if not exists opportunity_id uuid references public.business_opportunities(id) on delete set null;

alter table public.listing_reports drop constraint if exists listing_reports_listing_type_check;

alter table public.listing_reports
  add constraint listing_reports_listing_type_check
  check (listing_type in ('event', 'organiser', 'opportunity'));

create index if not exists idx_listing_reports_opportunity_id
  on public.listing_reports(opportunity_id)
  where opportunity_id is not null;
