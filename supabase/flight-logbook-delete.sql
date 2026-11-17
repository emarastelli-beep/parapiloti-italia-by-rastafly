-- PILOT ADVISOR · cancellazione sessioni del proprio logbook
-- Consente a ogni pilota di eliminare solo i propri voli.
-- I punti GPS collegati vengono eliminati tramite ON DELETE CASCADE.

drop policy if exists "Pilots delete own flight sessions" on public.flight_sessions;
create policy "Pilots delete own flight sessions"
  on public.flight_sessions
  for delete to authenticated
  using (auth.uid() = pilot_id);

grant delete on public.flight_sessions to authenticated;

notify pgrst, 'reload schema';
