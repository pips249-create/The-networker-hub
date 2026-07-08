-- Add @thenetworkerhub.com addresses to the safe test recipient list (Command Centre + fresh DBs).

insert into public.email_test_recipients (email, label, added_by)
select v.email, v.label, 'migration'
from (
  values
    ('catherine@thenetworkerhub.com', 'Catherine (Hub domain)'),
    ('rosie@thenetworkerhub.com', 'Rosie (Hub domain)')
) as v(email, label)
where not exists (
  select 1
  from public.email_test_recipients r
  where lower(trim(r.email)) = lower(trim(v.email))
);
