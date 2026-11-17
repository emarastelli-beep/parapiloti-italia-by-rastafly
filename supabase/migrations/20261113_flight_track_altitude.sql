-- Apply once in Supabase SQL Editor for altitude profiles on future real flights.
-- Existing tracks remain unchanged; altitude is unknown for older points.
alter table public.flight_track_points
  add column if not exists altitude_m double precision;
comment on column public.flight_track_points.altitude_m is
  'GPS altitude in metres above mean sea level (MSL), null if unavailable';
