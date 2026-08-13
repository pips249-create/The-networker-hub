-- Founding Organiser · 2026: badge is awarded on claim (before 1 Sept), not first publish.
-- Backfill / backdate: every page already claimed in-window gets the badge dated to their claim.

comment on column public.organisers.founding_organiser_at is
  'When this group earned Founding Organiser status (awarded on claim before soft launch).';

comment on column public.organisers.founding_homepage_until is
  'If set, group may appear in the homepage Founding Organisers strip until this time (first 50 claims).';

-- 1) Award badge to anyone who claimed before soft launch and is still missing it.
--    founding_organiser_at is backdated to ownership_claimed_at (claim day, not today).
update public.organisers
set founding_organiser_at = coalesce(ownership_claimed_at, now())
where ownership_claim_status = 'claimed'
  and founding_organiser_at is null
  and (
    ownership_claimed_at is null
    or ownership_claimed_at < timestamptz '2026-09-01 00:00:00+01'
  );

-- 2) Anyone who already has a badge from the old "first publish" rule: backdate
--    founding_organiser_at to their claim time when the claim was earlier.
update public.organisers
set founding_organiser_at = ownership_claimed_at
where ownership_claim_status = 'claimed'
  and ownership_claimed_at is not null
  and ownership_claimed_at < timestamptz '2026-09-01 00:00:00+01'
  and founding_organiser_at is not null
  and founding_organiser_at > ownership_claimed_at;

-- 3) First 50 claimants (by claim time) get homepage showcase through end of Nov.
with ranked as (
  select
    id,
    row_number() over (
      order by ownership_claimed_at asc nulls last, founding_organiser_at asc nulls last
    ) as rn
  from public.organisers
  where founding_organiser_at is not null
    and ownership_claim_status = 'claimed'
)
update public.organisers o
set founding_homepage_until = timestamptz '2026-11-30 23:59:59+00'
from ranked r
where o.id = r.id
  and r.rn <= 50
  and o.founding_homepage_until is null;
