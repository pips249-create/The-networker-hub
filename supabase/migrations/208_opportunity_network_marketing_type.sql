-- Allow product-selling network marketing as a distinct opportunity type.
-- Recruitment-primary listings remain banned in moderation + organiser terms.

alter table public.business_opportunities
  drop constraint if exists business_opportunities_type_check;

alter table public.business_opportunities
  add constraint business_opportunities_type_check
  check (type in (
    'franchise',
    'side-hustle',
    'partnership',
    'networking',
    'distributorship',
    'business-opportunity',
    'network-marketing'
  ));

comment on column public.business_opportunities.type is
  'Listing type. network-marketing = product-selling only; recruitment-primary copy is rejected by moderation.';
