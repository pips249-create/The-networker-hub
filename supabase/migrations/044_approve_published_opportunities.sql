-- Show submitted opportunities on the browse page (were stuck in Pending Review)
update public.business_opportunities
set approval_status = 'Approved'
where status = 'published'
  and approval_status = 'Pending Review';
