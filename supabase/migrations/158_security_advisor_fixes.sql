-- Address Supabase Security Advisor findings (views, function search_path, trigger EXECUTE).

-- ── Views: use invoker rights so underlying RLS applies ──────────────────────
do $$
declare
  v text;
begin
  foreach v in array array[
    'archived_events',
    'event_lock_status',
    'active_cms_blocks',
    'published_opportunities',
    'published_events',
    'browse_events_index'
  ]
  loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v);
    end if;
  end loop;
end $$;

-- ── Functions: pin search_path (prevents search_path hijacking) ──────────────
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as func
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(p.proconfig) as cfg
          where cfg like 'search_path=%'
        )
      )
  loop
    execute format('alter function %s set search_path = public', r.func);
  end loop;
end $$;

-- ── Trigger function: block direct public invocation ─────────────────────────
do $$
begin
  if to_regprocedure('public.hold_payout_on_event_cancellation()') is not null then
    revoke all on function public.hold_payout_on_event_cancellation() from public;
    revoke all on function public.hold_payout_on_event_cancellation() from anon, authenticated;
  end if;
end $$;
