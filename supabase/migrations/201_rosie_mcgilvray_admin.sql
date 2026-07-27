-- Grant Command Centre admin to Rosie McGilvray's Yahoo login (if auth user exists).
-- Platform @thenetworkerhub.com admins remain covered by 123_platform_admin_emails.sql.

do $$
declare
  admin_emails text[] := array[
    'rosie.mcgilvray@yahoo.co.uk'
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
        'Rosie McGilvray',
        now(),
        now(),
        null
      )
      on conflict (user_id) do update set
        role = 'admin',
        hub_view = 'organiser',
        display_name = coalesce(
          public.hub_accounts.display_name,
          excluded.display_name
        ),
        organiser_access_at = coalesce(public.hub_accounts.organiser_access_at, now()),
        organiser_email_verified_at = coalesce(public.hub_accounts.organiser_email_verified_at, now()),
        organiser_ui_hidden_at = null;
    end if;
  end loop;
end $$;
