-- Dati statistici e snapshot attrezzatura associati a ogni volo.
alter table public.flight_sessions
  add column if not exists avg_speed_kmh numeric(7,2),
  add column if not exists max_speed_kmh numeric(7,2),
  add column if not exists min_speed_kmh numeric(7,2),
  add column if not exists fuel_consumed_l numeric(8,2),
  add column if not exists equipment_snapshot jsonb not null default '{}'::jsonb;
