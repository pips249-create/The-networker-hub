-- Unpublished organiser profiles stay off public browse even when Verified (admin hide).

drop policy if exists "Public can view listed organisers" on public.organisers;

create policy "Public can view listed organisers"
  on public.organisers for select
  using (
    coalesce(listing_status, 'draft') is distinct from 'unpublished'
    and (
      verification_status = 'Verified'
      or listing_status = 'published'
    )
  );
