-- Social profile URLs on organiser (group) profiles — used for tagging in Networker social posts.

alter table public.organisers
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists x_url text;

comment on column public.organisers.instagram_url is 'Full Instagram profile URL for this group.';
comment on column public.organisers.facebook_url is 'Full Facebook page URL for this group.';
comment on column public.organisers.linkedin_url is 'Full LinkedIn company or profile URL for this group.';
comment on column public.organisers.x_url is 'Full X (Twitter) profile URL for this group.';
