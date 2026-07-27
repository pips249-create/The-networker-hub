-- Add Gary Dixon to the safe test recipient list (Command Centre test sends).

insert into public.email_test_recipients (email, label, added_by)
select v.email, v.label, 'migration'
from (
  values
    ('gary.dixon336@outlook.com', 'Gary Dixon')
) as v(email, label)
where not exists (
  select 1
  from public.email_test_recipients r
  where lower(trim(r.email)) = lower(trim(v.email))
);
