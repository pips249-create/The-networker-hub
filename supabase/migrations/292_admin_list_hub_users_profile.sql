-- Expose attendee profile fields on admin user directory rows.

create or replace function public.admin_list_hub_users(
  p_q text default '',
  p_role text default '',
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(both from coalesce(p_q, '')));
  v_role text := trim(both from coalesce(p_role, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_users jsonb;
begin
  if v_role not in ('', 'Admin', 'Organiser', 'Attendee') then
    v_role := '';
  end if;

  with base as (
    select
      ha.user_id,
      ha.role as hub_role,
      ha.display_name,
      ha.hub_view,
      ha.emails_enabled,
      ha.created_at as account_created_at,
      ha.last_seen_at,
      au.email as auth_email,
      au.last_sign_in_at,
      au.created_at as auth_created_at,
      nullif(trim(both from coalesce(au.raw_user_meta_data->>'full_name', '')), '') as auth_full_name,
      o.id as organiser_id,
      o.name as organiser_name,
      coalesce(nullif(trim(both from coalesce(o.contact_email, '')), ''), o.email) as organiser_email,
      o.outcode,
      o.featured,
      o.listing_status,
      a.name as attendee_name,
      a.email as attendee_email,
      a.location as attendee_location,
      a.job_title as attendee_job_title,
      a.business_sector as attendee_business_sector,
      a.home_region_slug as attendee_home_region_slug,
      case
        when ha.role = 'admin' then 'Admin'
        when o.id is not null or ha.hub_view = 'organiser' then 'Organiser'
        else 'Attendee'
      end as computed_role,
      coalesce(
        nullif(trim(both from coalesce(ha.display_name, '')), ''),
        nullif(trim(both from coalesce(o.name, '')), ''),
        nullif(trim(both from coalesce(a.name, '')), ''),
        nullif(trim(both from coalesce(au.raw_user_meta_data->>'full_name', '')), ''),
        '—'
      ) as sort_name,
      lower(
        coalesce(
          au.email,
          a.email,
          coalesce(nullif(trim(both from coalesce(o.contact_email, '')), ''), o.email),
          ''
        )
      ) as sort_email
    from public.hub_accounts ha
    join auth.users au on au.id = ha.user_id
    left join lateral (
      select id, name, email, contact_email, outcode, featured, listing_status
      from public.organisers
      where supabase_user_id = ha.user_id
      order by created_at asc nulls last
      limit 1
    ) o on true
    left join lateral (
      select name, email, location, job_title, business_sector, home_region_slug
      from public.attendees
      where supabase_user_id = ha.user_id
      order by created_at asc nulls last
      limit 1
    ) a on true
  ),
  filtered as (
    select *
    from base
    where
      (v_role = '' or computed_role = v_role)
      and (
        v_q = ''
        or lower(sort_name) like '%' || v_q || '%'
        or sort_email like '%' || v_q || '%'
      )
  )
  select count(*) into v_total from filtered;

  select coalesce(
    jsonb_agg(row_json order by sort_name_key, sort_email),
    '[]'::jsonb
  )
  into v_users
  from (
    select
      lower(sort_name) as sort_name_key,
      sort_email,
      jsonb_build_object(
        'id', user_id,
        'organiserId', organiser_id,
        'name', sort_name,
        'email', coalesce(nullif(auth_email, ''), nullif(attendee_email, ''), nullif(organiser_email, ''), '—'),
        'role', computed_role,
        'city', coalesce(
          nullif(trim(both from coalesce(outcode, '')), ''),
          nullif(trim(both from coalesce(attendee_location, '')), ''),
          '—'
        ),
        'location', coalesce(
          nullif(trim(both from coalesce(attendee_location, '')), ''),
          nullif(trim(both from coalesce(outcode, '')), ''),
          '—'
        ),
        'jobTitle', nullif(trim(both from coalesce(attendee_job_title, '')), ''),
        'businessSector', nullif(trim(both from coalesce(attendee_business_sector, '')), ''),
        'homeRegionSlug', nullif(trim(both from coalesce(attendee_home_region_slug, '')), ''),
        'postcode', '—',
        'status', 'Active',
        'featured', coalesce(featured, false),
        'emailsEnabled', emails_enabled is distinct from false,
        'hubView', coalesce(hub_view, 'attendee'),
        'displayName', display_name,
        'organiserListingStatus', listing_status,
        'accountCreatedAt', coalesce(account_created_at, auth_created_at),
        'lastSignInAt', last_sign_in_at,
        'lastSeenAt', last_seen_at,
        'authCreatedAt', auth_created_at
      ) as row_json
    from filtered
    order by lower(sort_name), sort_email
    limit v_limit
    offset v_offset
  ) page_rows;

  return jsonb_build_object(
    'users', v_users,
    'total', v_total
  );
end;
$$;
