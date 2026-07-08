-- Grant Command Centre admin to platform team emails (when auth users already exist).

do $$
declare
  admin_emails text[] := array[
    'catherine@thenetworkerhub.com',
    'rosie@thenetworkerhub.com'
  ];
  em text;
  uid uuid;
begin
  foreach em in array admin_emails loop
    select id into uid from auth.users where lower(email) = em;
    if uid is not null then
      insert into public.hub_accounts (
        user_id,
        role,
        hub_view,
        display_name,
        organiser_access_at,
        organiser_email_verified_at,
        organiser_ui_hidden_at
      )
      values (
        uid,
        'admin',
        'organiser',
        case em
          when 'catherine@thenetworkerhub.com' then 'Catherine'
          when 'rosie@thenetworkerhub.com' then 'Rosie'
          else null
        end,
        now(),
        now(),
        null
      )
      on conflict (user_id) do update set
        role = 'admin',
        hub_view = 'organiser',
        display_name = coalesce(
          excluded.display_name,
          public.hub_accounts.display_name
        ),
        organiser_access_at = coalesce(public.hub_accounts.organiser_access_at, now()),
        organiser_email_verified_at = coalesce(public.hub_accounts.organiser_email_verified_at, now()),
        organiser_ui_hidden_at = null;
    end if;
  end loop;
end $$;
