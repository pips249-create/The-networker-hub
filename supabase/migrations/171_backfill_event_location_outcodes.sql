-- Backfill city/postcode/outcode from location_label when structured fields were never saved.
-- City pages filter on outcode; many listings only had a combined location_label.

update public.events
set postcode = upper(
  substring(
    regexp_replace(coalesce(location_label, ''), '\s+', ' ', 'g')
    from '([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})'
  )
)
where coalesce(postcode, '') = ''
  and coalesce(location_label, '') ~* '[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}';

update public.events
set outcode = upper(
  substring(
    regexp_replace(coalesce(postcode, location_label, ''), '\s+', '', 'g')
    from '^([A-Z]{1,2}[0-9]{1,2}[A-Z]?)'
  )
)
where coalesce(outcode, '') = ''
  and coalesce(postcode, location_label, '') <> '';

-- Best-effort city: last comma-separated segment before a trailing UK postcode.
update public.events e
set city = initcap(trimmed.city)
from (
  select
    id,
    nullif(
      trim(
        regexp_replace(
          coalesce(location_label, ''),
          ',?\s*[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\s*$',
          '',
          'i'
        )
      ),
      ''
    ) as city_blob
  from public.events
  where coalesce(city, '') = ''
    and coalesce(location_label, '') <> ''
) src
cross join lateral (
  select nullif(trim((regexp_split_to_array(src.city_blob, ','))[array_length(regexp_split_to_array(src.city_blob, ','), 1)]), '') as city
) trimmed
where e.id = src.id
  and trimmed.city is not null
  and length(trimmed.city) between 2 and 64
  and trimmed.city !~* '^[A-Z]{1,2}[0-9]';
