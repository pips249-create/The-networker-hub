-- VAT display on public ticket panel: included in price vs added at checkout
alter table public.events
  add column if not exists vat_treatment text
    check (vat_treatment is null or vat_treatment in ('included', 'added'));
