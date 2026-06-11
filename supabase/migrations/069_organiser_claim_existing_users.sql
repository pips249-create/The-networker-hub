-- Require explicit claim for all existing group profiles (including already-linked users)

update public.organisers
set
  ownership_claim_status = 'pending',
  ownership_claimed_at = null
where ownership_claim_status = 'claimed'
  or ownership_claim_status is null;
