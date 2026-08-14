-- Staff / test organiser workspaces must never appear as Founding Organisers.
-- Rosie, Jamie, Catherine, and Pip test accounts.

update public.organisers o
set
  is_internal = true,
  founding_organiser_at = null,
  founding_homepage_until = null
where
  lower(coalesce(o.email, '')) in (
    'rosie@the-networker.co.uk',
    'rosie@thenetworkerhub.com',
    'jamie@thenetworkerhub.com',
    'catherine@thenetworkerhub.com',
    'pips249@gmail.com'
  )
  or lower(coalesce(o.contact_email, '')) in (
    'rosie@the-networker.co.uk',
    'rosie@thenetworkerhub.com',
    'jamie@thenetworkerhub.com',
    'catherine@thenetworkerhub.com',
    'pips249@gmail.com'
  )
  or exists (
    select 1
    from public.organiser_accounts a
    where a.id = o.organiser_account_id
      and lower(coalesce(a.email, '')) in (
        'rosie@the-networker.co.uk',
        'rosie@thenetworkerhub.com',
        'jamie@thenetworkerhub.com',
        'catherine@thenetworkerhub.com',
        'pips249@gmail.com'
      )
  );
