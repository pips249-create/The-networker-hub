-- Cleaner open day interest email subjects (override migration 269 stubs in admin).

update public.email_templates
set
  subject = 'Someone wants your open day — {{opportunity_title}}',
  updated_at = now()
where slug = 'opportunity_open_day_interest_received';

update public.email_templates
set
  subject = 'Thanks — open day interest received — {{opportunity_title}}',
  updated_at = now()
where slug = 'opportunity_open_day_interest_sent';
