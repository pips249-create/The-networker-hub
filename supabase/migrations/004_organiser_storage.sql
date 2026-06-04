-- Public bucket for organiser logos / event photos (uploaded via API, service role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organiser-assets',
  'organiser-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152;

drop policy if exists "Public read organiser assets" on storage.objects;
create policy "Public read organiser assets"
  on storage.objects for select
  using (bucket_id = 'organiser-assets');
