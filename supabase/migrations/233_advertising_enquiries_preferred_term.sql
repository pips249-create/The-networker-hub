-- Preferred sponsorship term from /advertising enquiry form.

alter table public.advertising_enquiries
  add column if not exists preferred_term text;

comment on column public.advertising_enquiries.preferred_term is
  'Preferred billing term from the enquiry form (e.g. Monthly (rolling), 3 months (5% off), Yearly (15% off)).';

-- Backfill from messages that were prefixed before this column existed.
update public.advertising_enquiries
set preferred_term = nullif(
  trim(both from regexp_replace(message, '(?s)^Preferred term:\s*([^\n]+).*', '\1')),
  ''
)
where preferred_term is null
  and message ~* '^Preferred term:';
