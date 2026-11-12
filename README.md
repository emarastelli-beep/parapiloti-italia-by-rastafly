# ParaPiloti in volo Italia by Rastafly

Prima versione tecnica della piattaforma community per piloti di paramotore.

## Contenuto caricato
- Interfaccia React responsive con sezioni Mappa, Piloti e Profilo.
- Mappa OpenStreetMap tramite Leaflet.
- Registrazione e accesso predisposti con Supabase Auth.
- Avvio/termine volontario della condivisione GPS.
- Schema Supabase iniziale per profili, sessioni e posizioni correnti.
- Configurazione PWA di base.

## Configurazione
1. Crea un progetto Supabase ed esegui `supabase/schema.sql` nel SQL Editor.
2. In Authentication > URL Configuration configura URL del sito e redirect URL.
3. Imposta le variabili d'ambiente di build:
   - `VITE_SUPABASE_URL`: URL del progetto Supabase.
   - `VITE_SUPABASE_ANON_KEY`: chiave publishable/anon pubblica del progetto.
4. Installa le dipendenze con `npm install`.
5. Avvia in locale con `npm run dev` oppure crea la build con `npm run build`.

Non inserire mai la chiave `service_role` o altre chiavi segrete nelle variabili `VITE_*`, nel browser o nel repository.

## Pubblicazione web
Importa questo repository in un servizio di hosting compatibile con Vite (ad esempio Vercel o Netlify), imposta le due variabili d'ambiente sopra indicate e usa:
- Build command: `npm run build`
- Output directory: `dist`

## Limiti importanti
Questo è un prototipo web, non ancora una app nativa iOS/Android e non è pronto per l'uso operativo in volo. La geolocalizzazione del browser può interrompersi quando l'app va in background o il telefono blocca lo schermo. Per il tracking affidabile in background servirà una versione mobile con modulo GPS nativo, permessi espliciti e test su dispositivi reali.

La posizione GPS non è un sistema certificato anticollisione, navigazione o soccorso. Non deve sostituire strumenti aeronautici o procedure di emergenza.

## Sicurezza e completamenti prima del rilascio
- Implementare gestione ruoli amministrativi esclusivamente lato server, con verifica del super-admin.
- Aggiungere scadenza e pulizia server-side delle posizioni non aggiornate.
- Completare storico tracce e statistiche con consenso e retention definiti.
- Aggiungere privacy policy, termini, informativa GDPR e cancellazione account.
- Verificare tutte le policy RLS e i flussi di registrazione/recupero account.
- Eseguire test funzionali, sicurezza, rete, batteria e GPS prima di qualsiasi rilascio.
