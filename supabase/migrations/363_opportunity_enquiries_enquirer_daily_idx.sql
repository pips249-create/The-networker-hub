-- Speed up per-account daily opportunity enquiry limits.
create index if not exists opportunity_enquiries_enquirer_email_created_at_idx
  on public.opportunity_enquiries (lower(enquirer_email), created_at desc);
