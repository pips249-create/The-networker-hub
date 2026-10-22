-- Attendance claims: attendee says they went → organiser confirms → organiser-confirmed review.
-- Also adds review provenance for ranking half-weighting.

alter table public.reviews
  add column if not exists provenance text not null default 'verified',
  add column if not exists attendance_claim_id uuid null;

alter table public.reviews drop constraint if exists reviews_provenance_check;
alter table public.reviews
  add constraint reviews_provenance_check
  check (provenance in ('verified', 'organiser_confirmed'));

comment on column public.reviews.provenance is
  'verified = Hub/Connected ticket path; organiser_confirmed = claim + organiser Yes.';

create table if not exists public.attendance_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  status text not null default 'pending',
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz null,
  responded_by_user_id uuid null,
  review_unlocked_until timestamptz null,
  review_id uuid null references public.reviews(id) on delete set null,
  organiser_email_sent_at timestamptz null,
  attendee_review_email_sent_at timestamptz null,
  deny_reason text null
);

alter table public.attendance_claims drop constraint if exists attendance_claims_status_check;
alter table public.attendance_claims
  add constraint attendance_claims_status_check
  check (status in ('pending', 'confirmed', 'denied', 'expired', 'cancelled'));

create unique index if not exists attendance_claims_attendee_event_open_idx
  on public.attendance_claims (attendee_id, event_id)
  where status in ('pending', 'confirmed');

create index if not exists attendance_claims_organiser_status_idx
  on public.attendance_claims (organiser_id, status, created_at desc);

create index if not exists attendance_claims_attendee_created_idx
  on public.attendance_claims (attendee_id, created_at desc);

create index if not exists attendance_claims_expires_idx
  on public.attendance_claims (expires_at)
  where status = 'pending';

comment on table public.attendance_claims is
  'Attendee claims attendance at a published past event; organiser Yes unlocks an organiser-confirmed review.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_attendance_claim_id_fkey'
  ) then
    alter table public.reviews
      add constraint reviews_attendance_claim_id_fkey
      foreign key (attendance_claim_id)
      references public.attendance_claims(id)
      on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

-- Keep display averages unweighted (all published reviews). Ranking weights in app code.
create or replace function update_organiser_rating()
returns trigger as $$
declare
  oid uuid;
begin
  oid := coalesce(new.organiser_id, old.organiser_id);
  if oid is null then
    return coalesce(new, old);
  end if;

  update public.organisers
  set
    average_rating = coalesce((
      select round(avg(rating)::numeric, 2)
      from public.reviews
      where organiser_id = oid and rating is not null
    ), 0),
    review_count = (
      select count(*)
      from public.reviews
      where organiser_id = oid
    )
  where id = oid;

  return coalesce(new, old);
end;
$$ language plpgsql;

insert into public.email_templates (
  slug,
  name,
  description,
  subject,
  body_html,
  placeholders,
  category
)
values (
  'attendance_claim_request',
  'Attendance claim request',
  'Sent to an organiser when an attendee claims they attended one of their past events.',
  '{{attendee_name}} says they attended {{event_name}} — did they?',
  '<p>stub — see email-templates/attendance-claim-request.html</p>',
  array[
    'user_name',
    'attendee_name',
    'attendee_email',
    'event_name',
    'event_date',
    'organiser_name',
    'confirm_url',
    'deny_url',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'support_email',
    'sponsor_row',
    'unsubscribe_url'
  ],
  'organisers'
),
(
  'attendance_claim_confirmed_review',
  'Attendance claim confirmed — leave review',
  'Sent to an attendee after the organiser confirms their attendance claim, unlocking a review.',
  'Confirmed — leave a review for {{organiser_name}}',
  '<p>stub — see email-templates/attendance-claim-confirmed-review.html</p>',
  array[
    'user_name',
    'attendee_name',
    'event_name',
    'event_date',
    'organiser_name',
    'review_url',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'support_email',
    'sponsor_row',
    'unsubscribe_url'
  ],
  'attendees'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
