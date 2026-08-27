-- Queue only truly submitted opportunity listings; pay-reminder tracking after Approve.

alter table public.business_opportunities
  add column if not exists review_submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_pay_reminder_sent_at timestamptz;

comment on column public.business_opportunities.review_submitted_at is
  'Set when the organiser hits Submit for review. Incomplete drafts stay Pending Review in DB but are excluded from the admin queue until this is set.';

comment on column public.business_opportunities.approved_at is
  'Set when admin Approves the listing (review-then-pay flow).';

comment on column public.business_opportunities.approved_pay_reminder_sent_at is
  'Set when the approved-but-unpaid reminder email was sent.';

create index if not exists business_opportunities_pending_review_queue_idx
  on public.business_opportunities (review_submitted_at desc)
  where approval_status = 'Pending Review' and review_submitted_at is not null;

create index if not exists business_opportunities_approved_awaiting_pay_idx
  on public.business_opportunities (approved_at)
  where approval_status = 'Approved'
    and approved_at is not null
    and listing_paid_at is null;

-- Keep today's Command Centre queue intact; new incomplete drafts will not get a timestamp.
update public.business_opportunities
set review_submitted_at = coalesce(updated_at, created_at, now())
where approval_status = 'Pending Review'
  and review_submitted_at is null;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'opportunity_listing_approved_pay_reminder',
    'Opportunity approved — pay reminder (lister)',
    'Reminder sent a few days after approval if the monthly listing subscription has not started.',
    'Reminder: pay to go live — {{opportunity_title}}',
    '<p>stub</p>',
    array[
      'owner_name',
      'opportunity_title',
      'pay_url',
      'checkout_url',
      'opportunity_edit_url',
      'dashboard_url',
      'opportunity_details_rows',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'unsubscribe_url',
      'support_email'
    ],
    'opportunities'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
