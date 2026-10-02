-- Optional member code, and a last day the offer stays visible.
-- A blank end date keeps the offer up. Members stop seeing it after ends_on.

alter table public.member_offers
  add column if not exists promo_code text not null default '',
  add column if not exists ends_on date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'member_offers_promo_code_len'
  ) then
    alter table public.member_offers
      add constraint member_offers_promo_code_len check (char_length(promo_code) <= 40);
  end if;
end $$;

comment on column public.member_offers.promo_code is
  'Optional code the member copies on the offer detail. Empty when the link is enough.';

comment on column public.member_offers.ends_on is
  'Last day members can see a published offer. Null means it stays up.';
