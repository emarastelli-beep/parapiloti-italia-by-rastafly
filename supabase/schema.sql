-- ParaPiloti in volo Italia by Rastafly: schema iniziale Supabase
-- Eseguire nel SQL Editor di un nuovo progetto Supabase.
create extension if not exists pgcrypto;

create type public.app_role as enum ('pilot', 'admin', 'super_admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  region text,
  role public.app_role not null default 'pilot',
  created_at timestamptz not null default now()
);

create table public.flight_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Una sola posizione corrente per pilota; non è uno storico GPS completo.
create table public.live_positions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  altitude_m integer,
  speed_kmh numeric(6,2),
  heading numeric(6,2),
  is_flying boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.flight_sessions enable row level security;
alter table public.live_positions enable row level security;

create policy "profiles readable by authenticated" on public.profiles
for select to authenticated using (true);
create policy "profile insert own" on public.profiles
for insert to authenticated with check (auth.uid() = id);
create policy "profile update own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (nickname, region) on public.profiles to authenticated;

create policy "live positions readable by authenticated" on public.live_positions
for select to authenticated using (true);
create policy "pilot writes own live position" on public.live_positions
for insert to authenticated with check (auth.uid() = user_id);
create policy "pilot updates own live position" on public.live_positions
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pilot deletes own live position" on public.live_positions
for delete to authenticated using (auth.uid() = user_id);

create policy "sessions readable by owner and admins" on public.flight_sessions
for select to authenticated using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin')
  )
);
create policy "pilot creates own session" on public.flight_sessions
for insert to authenticated with check (auth.uid() = user_id);
create policy "pilot ends own session" on public.flight_sessions
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, region)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nickname',''), split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'region','')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Promuovere manualmente il primo super-admin dal SQL Editor dopo la registrazione.
-- La gestione ruoli va implementata tramite funzione server-side che verifichi super_admin.