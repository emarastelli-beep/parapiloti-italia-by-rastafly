-- ParaPiloti Italia: attrezzatura personale e manutenzione
-- Eseguire nel Supabase SQL Editor DOPO le migrazioni del Logbook.
create table if not exists public.pilot_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'Altro',
  name text not null,
  model text,
  consumption_lph numeric(6,2) not null default 0 check (consumption_lph >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid references public.pilot_equipment(id) on delete set null,
  title text not null,
  interval_hours numeric(8,2),
  interval_days integer,
  last_done_at timestamptz,
  last_done_flight_hours numeric(10,2),
  next_due_at timestamptz,
  next_due_flight_hours numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  check (interval_hours is null or interval_hours > 0),
  check (interval_days is null or interval_days > 0)
);
create table if not exists public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  maintenance_item_id uuid references public.maintenance_items(id) on delete set null,
  equipment_id uuid references public.pilot_equipment(id) on delete set null,
  title text not null,
  completed_at timestamptz not null default now(),
  flight_hours_at_completion numeric(10,2) not null default 0,
  notes text
);
alter table public.pilot_equipment enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.maintenance_events enable row level security;
drop policy if exists "Pilots manage own equipment" on public.pilot_equipment;
create policy "Pilots manage own equipment" on public.pilot_equipment for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Pilots manage own maintenance items" on public.maintenance_items;
create policy "Pilots manage own maintenance items" on public.maintenance_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Pilots manage own maintenance events" on public.maintenance_events;
create policy "Pilots manage own maintenance events" on public.maintenance_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pilot_equipment_user_idx on public.pilot_equipment(user_id);
create index if not exists maintenance_items_user_idx on public.maintenance_items(user_id);
create index if not exists maintenance_events_user_date_idx on public.maintenance_events(user_id, completed_at desc);
