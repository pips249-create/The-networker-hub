-- Newsletter editorial image + layout variants

alter table public.newsletter_editions
  add column if not exists article_image_url text not null default '',
  add column if not exists layout text not null default 'magazine';

alter table public.newsletter_editions
  drop constraint if exists newsletter_editions_layout_check;

alter table public.newsletter_editions
  add constraint newsletter_editions_layout_check
  check (layout in ('magazine', 'classic', 'editorial'));

comment on column public.newsletter_editions.article_image_url is
  'Optional small image beside the editorial article (URL).';

comment on column public.newsletter_editions.layout is
  'Email shell design: magazine (default), classic, or editorial.';
