-- Monthly organiser ranking snapshots (Top 10 / 25 / 50) + congratulation emails

create table if not exists public.organiser_ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_key text not null unique,
  period_label text not null,
  total_ranked integer not null default 0,
  triggered_by text not null default 'cron'
);

create table if not exists public.organiser_ranking_entries (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.organiser_ranking_snapshots(id) on delete cascade,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  rank integer not null,
  tier text not null check (tier in ('top10', 'top25', 'top50')),
  label text not null,
  rating numeric(4, 2) not null default 0,
  review_count integer not null default 0,
  unique (snapshot_id, organiser_id)
);

create index if not exists idx_organiser_ranking_entries_snapshot
  on public.organiser_ranking_entries (snapshot_id, rank);

create index if not exists idx_organiser_ranking_entries_organiser
  on public.organiser_ranking_entries (organiser_id);

create table if not exists public.organiser_ranking_emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organiser_id uuid references public.organisers(id) on delete set null,
  snapshot_id uuid references public.organiser_ranking_snapshots(id) on delete set null,
  email_to text not null,
  tier text not null,
  period_label text not null,
  reason text not null check (reason in ('new', 'upgrade'))
);

create index if not exists idx_organiser_ranking_emails_organiser
  on public.organiser_ranking_emails (organiser_id, created_at desc);

grant select, insert, update, delete on public.organiser_ranking_snapshots to service_role;
grant select, insert, update, delete on public.organiser_ranking_entries to service_role;
grant select, insert, update, delete on public.organiser_ranking_emails to service_role;

comment on table public.organiser_ranking_snapshots is
  'Monthly snapshot metadata for networking group ranking badges (Top 10 / 25 / 50).';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values (
  'organiser_ranking_badge',
  'Ranking badge (organiser)',
  'Sent when a group earns or upgrades a Top 10 / 25 / 50 badge for the month.',
  'Congratulations — {{badge_label}} for {{period_label}}',
  '<p>Hi {{organiser_name}},</p>
<p>Great news — <strong>{{group_name}}</strong> is a <strong>{{badge_label}}</strong> on The Networker Hub for <strong>{{period_label}}</strong>.</p>
<p>Your group is ranked <strong>#{{rank}}</strong> of <strong>{{total_ranked}}</strong> rated networking groups this month, with an average of <strong>{{average_rating}}</strong> stars from <strong>{{review_count}}</strong> reviews.</p>
<p><a href="{{profile_url}}">View your public profile</a> · <a href="{{dashboard_url}}">Open organiser dashboard</a></p>
<p><strong>Share the news</strong></p>
<p style="background:#f8f4ec;border:1px solid #e8d9a8;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.5;">{{social_share_text}}</p>
<p>Thank you for creating great networking experiences on the Hub.</p>
<p>— The Networker Hub team</p>',
  array[
    'organiser_name',
    'group_name',
    'badge_label',
    'period_label',
    'rank',
    'total_ranked',
    'average_rating',
    'review_count',
    'profile_url',
    'dashboard_url',
    'social_share_text',
    'site_url'
  ]
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  placeholders = excluded.placeholders,
  updated_at = now();
