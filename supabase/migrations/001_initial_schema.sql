-- ═══════════════════════════════════════════════════════════════════════════
-- THE NETWORKER HUB — Supabase Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ORGANISERS
-- One organiser can run many events and workshops
-- ─────────────────────────────────────────────────────────────────────────────
create table public.organisers (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Identity
  name            text not null,
  email           text unique,
  phone           text,
  website         text,
  description     text,
  photo_url       text,

  -- Classification
  organiser_type  text check (organiser_type in ('Events', 'Academy', 'Both')),
  industries      text[],                    -- e.g. ['Technology', 'Finance']
  meeting_formats text[],                    -- e.g. ['In person', 'Online']

  -- Platform
  verification_status text default 'Pending'
    check (verification_status in ('Pending', 'Verified', 'Rejected')),
  featured        boolean default false,

  -- Stripe
  stripe_account_id text,
  payout_email    text,

  -- Auth link
  supabase_user_id uuid references auth.users(id) on delete set null,

  -- Airtable reference (kept during migration, remove after)
  airtable_id     text unique
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EVENTS
-- ─────────────────────────────────────────────────────────────────────────────
create table public.events (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Core details
  title           text not null,
  description     text,
  photo_url       text,
  event_type      text check (event_type in ('Networking / Meeting', 'Exhibition', 'Conference')),
  industries      text[],
  highlights      text[],

  -- Date & time
  starts_at       timestamptz,
  ends_at         timestamptz,

  -- Location
  meeting_type    text check (meeting_type in ('In person', 'Online', 'Hybrid')),
  venue           text,
  address         text,
  postcode        text,
  city            text,
  location_label  text,                      -- display string e.g. "Manchester, M1 2JN"
  meeting_link    text,                      -- for online events
  latitude        numeric(10,6),
  longitude       numeric(10,6),

  -- Screening (for application-based tickets)
  screening_q1    text default 'What industry are you in?',
  screening_q2    text default 'What is your job title?',
  auto_approve    boolean default true,

  -- Recurrence
  recurrence_pattern text check (recurrence_pattern in (
    'Weekly', 'Bi-weekly', 'Monthly'
  )),
  recurrence_end_date date,

  -- Platform
  approval_status text default 'Pending Review'
    check (approval_status in ('Pending Review', 'Approved', 'Rejected')),
  featured        boolean default false,
  stripe_payment_link text,

  -- Stats (updated by triggers or application)
  average_rating  numeric(3,2) default 0,
  review_count    integer default 0,

  -- Relationships
  organiser_id    uuid references public.organisers(id) on delete set null,

  -- Airtable reference
  airtable_id     text unique
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TICKETS
-- Each event can have multiple ticket types
-- ─────────────────────────────────────────────────────────────────────────────
create table public.tickets (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Core
  name            text not null,
  description     text,
  price           numeric(10,2) default 0,
  quantity        integer,                   -- null = unlimited
  ticket_type     text default 'Standard'
    check (ticket_type in ('Standard', 'Application-based')),

  -- Sale window
  sale_starts_at  timestamptz,
  sale_ends_at    timestamptz,

  -- Status
  status          text default 'Active'
    check (status in ('Active', 'Paused', 'Sold out')),

  -- Relationship
  event_id        uuid references public.events(id) on delete cascade,

  -- Airtable reference
  airtable_id     text unique
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ATTENDEES
-- People who attend events (linked to Supabase auth users)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.attendees (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Identity
  name            text,
  email           text unique,
  company         text,
  location        text,
  interests       text[],

  -- Preferences
  marketing_opt_in boolean default false,

  -- Auth link
  supabase_user_id uuid references auth.users(id) on delete set null,

  -- Airtable reference
  airtable_id     text unique
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REGISTRATIONS
-- A booking by an attendee for an event ticket
-- ─────────────────────────────────────────────────────────────────────────────
create table public.registrations (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Relationships
  attendee_id     uuid references public.attendees(id) on delete set null,
  event_id        uuid references public.events(id) on delete cascade,
  ticket_id       uuid references public.tickets(id) on delete set null,
  organiser_id    uuid references public.organisers(id) on delete set null,

  -- Payment
  payment_status  text default 'Pending'
    check (payment_status in ('Pending', 'Paid', 'Refunded', 'Free')),
  amount_paid     numeric(10,2) default 0,
  stripe_payment_intent_id text,

  -- Application flow (for application-based tickets)
  application_status text default 'Approved'
    check (application_status in ('Pending', 'Approved', 'Denied')),
  screening_answer_industry  text,
  screening_answer_job_title text,

  -- Confirmation
  ticket_email_sent boolean default false,
  ticket_pdf_sent   boolean default false,
  meeting_link      text,

  -- Airtable reference
  airtable_id     text unique
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. REVIEWS
-- Left by attendees after events
-- ─────────────────────────────────────────────────────────────────────────────
create table public.reviews (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Relationships
  attendee_id     uuid references public.attendees(id) on delete set null,
  event_id        uuid references public.events(id) on delete cascade,
  organiser_id    uuid references public.organisers(id) on delete set null,

  -- Content
  rating          integer check (rating between 1 and 5),
  review_text     text,
  organiser_response text,

  -- Airtable reference
  airtable_id     text unique
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. WORKSHOPS
-- Academy training sessions
-- ─────────────────────────────────────────────────────────────────────────────
create table public.workshops (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),

  -- Core
  title           text not null,
  description     text,
  photo_url       text,

  -- Classification
  workshop_type   text check (workshop_type in (
    'Workshop', 'Seminar', 'Webinar', 'Masterclass'
  )),
  level           text check (level in (
    'Beginner', 'Intermediate', 'Advanced', 'Masterclass'
  )),
  timescale       text check (timescale in (
    '15 minutes', '30 minutes', 'Half day', 'Full day'
  )),
  format          text check (format in ('In person', 'Online')),
  industries      text[],

  -- Date & time
  starts_at       timestamptz,
  ends_at         timestamptz,

  -- Location
  location        text,

  -- Ticketing
  ticket_price    numeric(10,2) default 0,
  ticket_quantity integer,
  sale_starts_at  timestamptz,
  sale_ends_at    timestamptz,
  stripe_payment_link text,

  -- Platform
  approval_status text default 'Pending Review'
    check (approval_status in ('Pending Review', 'Approved', 'Rejected')),
  featured        boolean default false,

  -- Relationship
  organiser_id    uuid references public.organisers(id) on delete set null,

  -- Airtable reference
  airtable_id     text unique
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES — speeds up the most common queries on your site
-- ═══════════════════════════════════════════════════════════════════════════

-- Events — most common filters
create index idx_events_organiser    on public.events(organiser_id);
create index idx_events_starts_at    on public.events(starts_at);
create index idx_events_approval     on public.events(approval_status);
create index idx_events_featured     on public.events(featured);
create index idx_events_meeting_type on public.events(meeting_type);
create index idx_events_location     on public.events(latitude, longitude);

-- Tickets
create index idx_tickets_event       on public.tickets(event_id);

-- Registrations
create index idx_regs_attendee       on public.registrations(attendee_id);
create index idx_regs_event          on public.registrations(event_id);
create index idx_regs_organiser      on public.registrations(organiser_id);

-- Reviews
create index idx_reviews_event       on public.reviews(event_id);
create index idx_reviews_organiser   on public.reviews(organiser_id);

-- Workshops
create index idx_workshops_organiser on public.workshops(organiser_id);
create index idx_workshops_featured  on public.workshops(featured);

-- Organisers
create index idx_organisers_featured on public.organisers(featured);
create index idx_organisers_user     on public.organisers(supabase_user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Controls who can read and write what
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table public.organisers    enable row level security;
alter table public.events        enable row level security;
alter table public.tickets       enable row level security;
alter table public.attendees     enable row level security;
alter table public.registrations enable row level security;
alter table public.reviews       enable row level security;
alter table public.workshops     enable row level security;

-- ── PUBLIC READ (anyone can browse approved events, organisers, etc.) ────────

create policy "Public can view approved events"
  on public.events for select
  using (approval_status = 'Approved');

create policy "Public can view approved workshops"
  on public.workshops for select
  using (approval_status = 'Approved');

create policy "Public can view verified organisers"
  on public.organisers for select
  using (verification_status = 'Verified');

create policy "Public can view tickets for approved events"
  on public.tickets for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.approval_status = 'Approved'
    )
  );

create policy "Public can view reviews"
  on public.reviews for select
  using (true);

-- ── ATTENDEES — own their data ────────────────────────────────────────────────

create policy "Attendees can view own profile"
  on public.attendees for select
  using (supabase_user_id = auth.uid());

create policy "Attendees can update own profile"
  on public.attendees for update
  using (supabase_user_id = auth.uid());

create policy "Attendees can view own registrations"
  on public.registrations for select
  using (
    attendee_id in (
      select id from public.attendees where supabase_user_id = auth.uid()
    )
  );

create policy "Attendees can create registrations"
  on public.registrations for insert
  with check (
    attendee_id in (
      select id from public.attendees where supabase_user_id = auth.uid()
    )
  );

create policy "Attendees can create reviews"
  on public.reviews for insert
  with check (
    attendee_id in (
      select id from public.attendees where supabase_user_id = auth.uid()
    )
  );

-- ── ORGANISERS — manage their own content ────────────────────────────────────

create policy "Organisers can view own profile"
  on public.organisers for select
  using (supabase_user_id = auth.uid());

create policy "Organisers can update own profile"
  on public.organisers for update
  using (supabase_user_id = auth.uid());

create policy "Organisers can manage own events"
  on public.events for all
  using (
    organiser_id in (
      select id from public.organisers where supabase_user_id = auth.uid()
    )
  );

create policy "Organisers can manage own workshops"
  on public.workshops for all
  using (
    organiser_id in (
      select id from public.organisers where supabase_user_id = auth.uid()
    )
  );

create policy "Organisers can manage own tickets"
  on public.tickets for all
  using (
    event_id in (
      select e.id from public.events e
      join public.organisers o on e.organiser_id = o.id
      where o.supabase_user_id = auth.uid()
    )
  );

create policy "Organisers can view registrations for their events"
  on public.registrations for select
  using (
    organiser_id in (
      select id from public.organisers where supabase_user_id = auth.uid()
    )
  );

create policy "Organisers can respond to reviews"
  on public.reviews for update
  using (
    organiser_id in (
      select id from public.organisers where supabase_user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER — auto-update event rating when a review is added
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function update_event_rating()
returns trigger as $$
begin
  update public.events
  set
    average_rating = (
      select round(avg(rating)::numeric, 2)
      from public.reviews
      where event_id = new.event_id
    ),
    review_count = (
      select count(*)
      from public.reviews
      where event_id = new.event_id
    )
  where id = new.event_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_update_event_rating
  after insert or update on public.reviews
  for each row execute function update_event_rating();

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- All 7 tables created with indexes, RLS policies, and triggers
-- Next step: run the migration script to copy data from Airtable
-- ═══════════════════════════════════════════════════════════════════════════
