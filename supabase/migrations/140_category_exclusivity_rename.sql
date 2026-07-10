-- Rename One Seat Only Policy (OSOP) to Category Exclusivity

update public.events
set attendance_mode = 'category_exclusivity'
where attendance_mode = 'osop';

alter table public.events
  drop constraint if exists events_attendance_mode_check;

alter table public.events
  add constraint events_attendance_mode_check
  check (attendance_mode in ('tickets', 'category_exclusivity', 'guest_programme'));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registrations'
      and column_name = 'osop_payment_reminder_sent_at'
  ) then
    alter table public.registrations
      rename column osop_payment_reminder_sent_at to category_exclusivity_payment_reminder_sent_at;
  end if;
end $$;

comment on column public.registrations.category_exclusivity_payment_reminder_sent_at is
  'When the Category Exclusivity payment reminder was sent after approval.';

update public.email_templates
set slug = 'category_exclusivity_payment_reminder',
    name = 'Category Exclusivity payment reminder (attendee)',
    description = 'Sent when a Category Exclusivity application was approved but payment is still pending.'
where slug = 'osop_payment_reminder';

update public.email_templates
set description = 'Notifies the organiser when someone applies for a Category Exclusivity event.'
where slug = 'organiser_new_application';

update public.email_templates
set description = 'Sent when an attendee submits a Category Exclusivity application.'
where slug = 'application_received';

update public.email_templates
set description = 'Sent when an organiser approves a Category Exclusivity application — includes My Hub payment link for paid events.'
where slug = 'application_approved';

update public.email_templates
set description = 'Sent when an organiser denies a Category Exclusivity application.'
where slug = 'application_denied';

comment on column public.registrations.application_denial_reason is
  'Optional note from the organiser when denying a Category Exclusivity application; included in the attendee email when set.';
