-- Approved events were hidden on browse when organiser listing_status stayed 'draft'.
-- Publish flow now sets listing_status = 'published'; backfill existing rows.

update public.organisers o
set listing_status = 'published'
where coalesce(o.listing_status, 'draft') = 'draft'
  and exists (
    select 1
    from public.events e
    where e.organiser_id = o.id
      and e.approval_status = 'Approved'
  );
