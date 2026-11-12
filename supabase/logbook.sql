-- Logbook GPS: punti completi della traccia per ogni sessione di volo.
-- Eseguire una sola volta nel Supabase SQL Editor del progetto ParaPiloti.
create table if not exists public.flight_track_points (
  id bigint generated always as identity primary key,
  flight_session_id uuid not null references public.flight_sessions(id) on delete cascade,
  pilot_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  recorded_at timestamptz not null default now()
);

create index if not exists flight_track_points_session_time_idx
  on public.flight_track_points (flight_session_id, recorded_at);

alter table public.flight_track_points enable row level security;

drop policy if exists "Pilots read own flight track points" on public.flight_track_points;
create policy "Pilots read own flight track points"
  on public.flight_track_points for select to authenticated
  using (auth.uid() = pilot_id);

drop policy if exists "Pilots add own flight track points" on public.flight_track_points;
create policy "Pilots add own flight track points"
  on public.flight_track_points for insert to authenticated
  with check (
    auth.uid() = pilot_id
    and exists (
      select 1 from public.flight_sessions fs
      where fs.id = flight_session_id and fs.pilot_id = auth.uid()
    )
  );

grant select, insert on public.flight_track_points to authenticated;
grant usage, select on sequence public.flight_track_points_id_seq to authenticated;
