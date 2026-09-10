-- Partner programme (Phase 1): partners, click/checkout attributions, commission ledger.
-- See docs/PARTNER-PROGRAMME.md

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  email text not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_partners_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$')
);

create unique index if not exists affiliate_partners_code_uidx
  on public.affiliate_partners (code);

create index if not exists affiliate_partners_active_idx
  on public.affiliate_partners (active, code);

comment on table public.affiliate_partners is
  'Invite-only referral partners for opportunity listings and sponsorship sales.';

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners (id) on delete cascade,
  code text not null,
  source text not null default 'cookie',
  customer_email text,
  context text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_attributions_partner_created_idx
  on public.affiliate_attributions (partner_id, created_at desc);

create index if not exists affiliate_attributions_email_idx
  on public.affiliate_attributions (lower(customer_email), created_at desc)
  where customer_email is not null;

comment on table public.affiliate_attributions is
  'Audit of partner link/code use at enquiry or checkout (not the payable ledger).';

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners (id) on delete restrict,
  code text not null,
  product_type text not null,
  sale_net_ex_vat_pence integer not null,
  commission_rate numeric(5,4) not null default 0.2000,
  commission_net_pence integer not null,
  stripe_payment_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  checkout_session_id text,
  customer_email text,
  payment_at timestamptz not null,
  eligible_from timestamptz not null,
  status text not null default 'hold',
  statement_id uuid,
  payout_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  constraint affiliate_commissions_status_check
    check (status in ('hold', 'eligible', 'statemented', 'paid', 'void')),
  constraint affiliate_commissions_sale_check check (sale_net_ex_vat_pence <> 0),
  constraint affiliate_commissions_commission_check check (commission_net_pence <> 0)
);

create index if not exists affiliate_commissions_partner_status_idx
  on public.affiliate_commissions (partner_id, status, eligible_from);

create unique index if not exists affiliate_commissions_stripe_payment_uidx
  on public.affiliate_commissions (stripe_payment_id)
  where stripe_payment_id is not null and commission_net_pence > 0;

create unique index if not exists affiliate_commissions_stripe_invoice_uidx
  on public.affiliate_commissions (stripe_invoice_id)
  where stripe_invoice_id is not null and commission_net_pence > 0;

comment on table public.affiliate_commissions is
  'Immutable commission ledger for the partner programme. Clawbacks are negative rows.';

alter table public.advertising_enquiries
  add column if not exists referred_by text;

comment on column public.advertising_enquiries.referred_by is
  'Partner referral code from cookie, link, or manual intro at enquiry time.';

alter table public.affiliate_partners enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_commissions enable row level security;

revoke all on table public.affiliate_partners from anon, authenticated;
revoke all on table public.affiliate_attributions from anon, authenticated;
revoke all on table public.affiliate_commissions from anon, authenticated;

grant select, insert, update, delete on table public.affiliate_partners to service_role;
grant select, insert, update, delete on table public.affiliate_attributions to service_role;
grant select, insert, update, delete on table public.affiliate_commissions to service_role;
