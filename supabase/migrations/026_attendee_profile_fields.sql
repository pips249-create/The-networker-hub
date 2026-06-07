-- Account settings profile fields on attendees (replaces Airtable Users profile columns).

alter table public.attendees
  add column if not exists business_sector text,
  add column if not exists market_preferences text;
