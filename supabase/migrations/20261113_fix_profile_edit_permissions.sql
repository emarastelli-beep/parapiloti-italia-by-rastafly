-- Fix: the original schema grants UPDATE only on nickname and region.
-- Allow authenticated pilots to edit their own avatar as well, without granting role changes.
alter table public.profiles add column if not exists avatar_url text;
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant update (nickname, region, avatar_url) on table public.profiles to authenticated;
alter table public.profiles enable row level security;
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
