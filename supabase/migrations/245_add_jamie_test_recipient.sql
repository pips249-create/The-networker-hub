-- Add Jamie to safe test recipients
insert into public.email_test_recipients (email, label, added_by)
select v.email, v.label, 'migration'
from (
  values
    ('jamie@thenetworkerhub.com', 'Jamie')
) as v(email, label)
where not exists (
  select 1
  from public.email_test_recipients r
  where lower(trim(r.email)) = lower(trim(v.email))
);
