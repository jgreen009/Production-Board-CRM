-- Milestone 5: artwork storage bucket + RLS. Private bucket (not public) —
-- every read goes through a short-lived signed URL, never a public URL.
-- 25 MB per-file cap enforced at the bucket level too, as a backstop
-- behind the client-side check in src/utils/artworkValidation.ts.

insert into storage.buckets (id, name, public, file_size_limit)
values ('artwork-originals', 'artwork-originals', false, 26214400) -- 25 MB
on conflict (id) do nothing;

-- Same "shared company dataset" reasoning as every other operational
-- table: any signed-in staff member can read/write/replace/remove
-- artwork files, scoped to this one bucket only.
create policy "staff can read artwork-originals" on storage.objects
  for select to authenticated using (bucket_id = 'artwork-originals');
create policy "staff can insert artwork-originals" on storage.objects
  for insert to authenticated with check (bucket_id = 'artwork-originals');
create policy "staff can update artwork-originals" on storage.objects
  for update to authenticated using (bucket_id = 'artwork-originals') with check (bucket_id = 'artwork-originals');
create policy "staff can delete artwork-originals" on storage.objects
  for delete to authenticated using (bucket_id = 'artwork-originals');
