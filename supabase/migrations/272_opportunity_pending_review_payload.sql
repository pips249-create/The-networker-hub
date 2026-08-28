-- Staged listing edits: live approved listings stay on site while updates await review.

alter table public.business_opportunities
  add column if not exists pending_review_payload jsonb;

comment on column public.business_opportunities.pending_review_payload is
  'Proposed listing content while the approved live version remains public until admin approves.';

create index if not exists business_opportunities_pending_review_payload_idx
  on public.business_opportunities ((pending_review_payload is not null))
  where pending_review_payload is not null;
