-- Initial safe test recipients for Command Centre email test sends

insert into public.email_test_recipients (email, label, added_by)
select v.email, v.label, 'migration'
from (
  values
    ('rosie@the-networker.co.uk', 'Rosie'),
    ('catherine@the-networker.co.uk', 'Catherine'),
    ('andreagaiga8@gmail.com', 'Andrea'),
    ('pips249@gmail.com', 'Pips'),
    ('hancher249@gmail.com', 'Hancher'),
    ('rosie.mcgilvray@yahoo.co.uk', 'Rosie (Yahoo)')
) as v(email, label)
where not exists (
  select 1
  from public.email_test_recipients r
  where lower(trim(r.email)) = lower(trim(v.email))
);
