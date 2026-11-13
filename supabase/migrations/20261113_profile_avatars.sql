-- Run once in Supabase SQL Editor for editable pilot profiles and public avatars.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pilot-avatars', 'pilot-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "pilot_avatars_public_read" on storage.objects;
create policy "pilot_avatars_public_read" on storage.objects for select
to public using (bucket_id = 'pilot-avatars');

drop policy if exists "pilot_avatars_own_upload" on storage.objects;
create policy "pilot_avatars_own_upload" on storage.objects for insert
to authenticated with check (
  bucket_id = 'pilot-avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "pilot_avatars_own_delete" on storage.objects;
create policy "pilot_avatars_own_delete" on storage.objects for delete
to authenticated using (
  bucket_id = 'pilot-avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
