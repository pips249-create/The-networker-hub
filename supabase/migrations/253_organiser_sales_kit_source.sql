-- Track whether an outreach row was typed in, or auto-logged from impersonate / listing.
alter table public.organiser_sales_demos
  add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organiser_sales_demos_source_check'
  ) then
    alter table public.organiser_sales_demos
      add constraint organiser_sales_demos_source_check
      check (source in ('manual', 'impersonate', 'event_create'));
  end if;
end $$;

comment on column public.organiser_sales_demos.source is
  'manual = typed in Command Centre; impersonate / event_create = auto from team activity.';
