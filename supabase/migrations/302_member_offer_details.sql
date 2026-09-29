-- Longer copy shown when a member opens an offer card.
-- The card stays short; the detail page holds the full note and the outbound link.

alter table public.member_offers
  add column if not exists details text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'member_offers_details_len'
  ) then
    alter table public.member_offers
      add constraint member_offers_details_len check (char_length(details) <= 4000);
  end if;
end $$;

comment on column public.member_offers.details is
  'Fuller note shown after a member opens the offer card. href is the outbound offer link.';

update public.member_offers
set details = 'Swft business cards for members, with three months free. Open the offer to see how to claim it.'
where seed_key = 'swft-business-cards'
  and details = '';

update public.member_offers
set details = 'A practical look at which franchise fits you — what to weigh up, and where to go next for help deciding.'
where seed_key = 'franchise-fit'
  and details = '';
