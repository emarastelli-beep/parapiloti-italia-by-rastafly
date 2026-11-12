import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Wind, Map as MapIcon, Users, UserCircle, Plane, Square, LogOut, Shield, Mail, LocateFixed, Clock3, Gauge, Route, Menu, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const demoPilots = [
  { id: "demo-1", nickname: "VentoAlto", region: "Veneto", lat: 45.44, lng: 12.33, altitude_m: 420, speed_kmh: 34, heading: 110, demo: true },
  { id: "demo-2", nickname: "SkyLombardia", region: "Lombardia", lat: 45.62, lng: 9.82, altitude_m: 610, speed_kmh: 28, heading: 205, demo: true },
  { id: "demo-3", nickname: "TuscanyFly", region: "Toscana", lat: 43.77, lng: 11.25, altitude_m: 530, speed_kmh: 31, heading: 80, demo: true }
];
const pilotIcon = L.divIcon({ className: "pilot-marker", html: '<div class="pilot-marker-inner">✈</div>', iconSize: [34, 34], iconAnchor: [17, 17] });

function MapView({ pilots, ownPosition }) {
  const center = ownPosition ? [ownPosition.lat, ownPosition.lng] : [42.8, 12.5];
  return <MapContainer center={center} zoom={ownPosition ? 9 : 6} scrollWheelZoom className="map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {pilots.map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={pilotIcon}><Popup><b>{p.nickname}</b><br />{p.region || "Italia"}<br />{p.altitude_m ?? "—"} m · {p.speed_kmh ?? "—"} km/h{p.demo ? <><br /><small>Posizione dimostrativa</small></> : null}</Popup></Marker>)}
    {ownPosition && <Marker position={[ownPosition.lat, ownPosition.lng]}><Popup>La tua posizione GPS</Popup></Marker>}
  </MapContainer>;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [region, setRegion] = useState("Veneto");
  const [authMode, setAuthMode] = useState("signup");
  const [tab, setTab] = useState("map");
  const [pilots, setPilots] = useState(demoPilots);
  const [flying, setFlying] = useState(false);
  const [ownPosition, setOwnPosition] = useState(null);
  const [status, setStatus] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const configured = Boolean(supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => { if (data) { setProfile(data); setNickname(data.nickname || ""); setRegion(data.region || "Veneto"); } });
    refreshPilots();
  }, [session]);

  async function refreshPilots() {
    if (!supabase) return;
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("live_positions").select("user_id,lat,lng,altitude_m,speed_kmh,heading,updated_at,profiles(nickname,region)").gte("updated_at", cutoff);
    if (error) { setStatus(error.message); return; }
    setPilots((data || []).map(p => ({ id: p.user_id, lat: p.lat, lng: p.lng, altitude_m: p.altitude_m, speed_kmh: p.speed_kmh, heading: p.heading, nickname: p.profiles?.nickname || "Pilota", region: p.profiles?.region })));
  }

  async function handleAuth(e) {
    e.preventDefault(); setStatus("");
    if (!supabase) { setStatus("Per attivare registrazione e accesso, configura prima le credenziali Supabase."); return; }
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { nickname, region } } });
      setStatus(error ? error.message : "Registrazione inviata. Controlla la tua email per confermare l'indirizzo.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setStatus(error ? error.message : "Accesso effettuato.");
    }
  }

  async function logout() {
    if (window.__flightWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(window.__flightWatch);
    window.__flightWatch = null;
    if (supabase) await supabase.auth.signOut();
    setFlying(false); setOwnPosition(null);
  }

  async function startFlight() {
    if (!session) { setStatus("Accedi o registrati prima di avviare un volo."); setTab("profile"); return; }
    if (!navigator.geolocation) { setGpsError("Geolocalizzazione non supportata da questo dispositivo."); return; }
    setGpsError("");
    navigator.geolocation.getCurrentPosition(async pos => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, altitude_m: pos.coords.altitude == null ? null : Math.round(pos.coords.altitude), speed_kmh: pos.coords.speed == null ? null : Math.round(pos.coords.speed * 3.6), heading: pos.coords.heading, updated_at: new Date().toISOString() };
      setOwnPosition(p); setFlying(true); setStatus("Sessione avviata. Mantieni l'app autorizzata alla posizione.");
      await publishPosition(p);
      const { error } = await supabase.from("flight_sessions").insert({ user_id: session.user.id });
      if (error) setStatus("Posizione inviata, ma apertura sessione non riuscita: " + error.message);
      window.__flightWatch = navigator.geolocation.watchPosition(async next => {
        const q = { lat: next.coords.latitude, lng: next.coords.longitude, altitude_m: next.coords.altitude == null ? null : Math.round(next.coords.altitude), speed_kmh: next.coords.speed == null ? null : Math.round(next.coords.speed * 3.6), heading: next.coords.heading, updated_at: new Date().toISOString() };
        setOwnPosition(q); await publishPosition(q);
      }, err => setGpsError(err.message), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    }, err => setGpsError(err.message), { enableHighAccuracy: true, timeout: 20000 });
  }

  async function publishPosition(p) {
    if (!supabase || !session) return;
    const { error } = await supabase.from("live_positions").upsert({ user_id: session.user.id, ...p, is_flying: true });
    if (error) setStatus("Errore invio posizione: " + error.message);
    else refreshPilots();
  }

  async function stopFlight() {
    if (window.__flightWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(window.__flightWatch);
    window.__flightWatch = null; setFlying(false); setOwnPosition(null);
    if (supabase && session) {
      await supabase.from("live_positions").delete().eq("user_id", session.user.id);
      await supabase.from("flight_sessions").update({ ended_at: new Date().toISOString() }).eq("user_id", session.user.id).is("ended_at", null);
    }
    setStatus("Volo terminato. La tua posizione non è più visibile sulla mappa.");
    refreshPilots();
  }

  const activePilots = pilots.filter(p => !p.demo).length;
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Wind size={22} /></div><div><strong>ParaPiloti</strong><span>IN VOLO ITALIA</span></div></div>
      <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? "nav open" : "nav"}>
        <button className={tab === "map" ? "nav-active" : ""} onClick={() => { setTab("map"); setMenuOpen(false); }}><MapIcon size={17} /> Mappa</button>
        <button className={tab === "pilots" ? "nav-active" : ""} onClick={() => { setTab("pilots"); setMenuOpen(false); }}><Users size={17} /> Piloti</button>
        <button className={tab === "profile" ? "nav-active" : ""} onClick={() => { setTab("profile"); setMenuOpen(false); }}><UserCircle size={17} /> Profilo</button>
      </nav>
      <div className="header-right">{session ? <><span className="signed-in">{profile?.nickname || session.user.email}</span><button className="icon-btn" onClick={logout} title="Esci"><LogOut size={18} /></button></> : <button className="small-primary" onClick={() => setTab("profile")}>Accedi</button>}</div>
    </header>
    <main>
      <section className="hero">
        <div><div className="eyebrow"><span className="pulse"></span> COMMUNITY NAZIONALE</div><h1>Il cielo è più bello<br /><em>quando si vola insieme.</em></h1><p>Scopri i piloti in volo, condividi la tua posizione e ritrova la tua community, in tutta Italia.</p></div>
        <div className="hero-stats"><div><b>{configured ? activePilots : "—"}</b><span>Piloti live</span></div><div><b>{configured ? "Online" : "Demo"}</b><span>Stato piattaforma</span></div></div>
      </section>
      <div className="content-grid">
        <section className="main-panel">
          {tab === "map" && <><div className="panel-heading"><div><div className="eyebrow dark">LIVE TRACKING</div><h2>Mappa dei piloti</h2><p>Le posizioni reali sono visibili solo agli utenti autenticati.</p></div><span className="live-pill"><i></i> LIVE</span></div>
            <div className="map-wrap"><MapView pilots={pilots} ownPosition={ownPosition} /><div className="map-legend"><span><i className="legend-dot green"></i> Piloti attivi</span><span><i className="legend-dot blue"></i> La tua posizione</span></div></div>
            <div className="flight-control"><div><b>{flying ? "Sessione di volo attiva" : "Pronto al decollo?"}</b><span>{flying ? "La posizione viene condivisa con gli iscritti." : "Avvia la condivisione quando sei pronto."}</span></div><button className={flying ? "danger-btn" : "primary-btn"} onClick={flying ? stopFlight : startFlight}>{flying ? <Square size={17} /> : <Plane size={17} />} {flying ? "Termina volo" : "Avvia il mio volo"}</button></div>
            {gpsError && <div className="notice error">{gpsError}</div>}
          </>}
          {tab === "pilots" && <><div className="panel-heading"><div><div className="eyebrow dark">COMMUNITY</div><h2>Piloti in volo</h2><p>Elenco delle posizioni aggiornate di recente.</p></div><Users /></div>{pilots.map(p => <div className="pilot-row" key={p.id}><div className="avatar">{p.nickname?.slice(0, 1)?.toUpperCase() || "P"}</div><div className="pilot-info"><b>{p.nickname}</b><span>{p.region || "Italia"} · {p.demo ? "Posizione demo" : "In volo"}</span></div><div className="pilot-data"><b>{p.altitude_m ?? "—"} m</b><span>{p.speed_kmh ?? "—"} km/h</span></div><span className="status-dot"></span></div>)}</>}
          {tab === "profile" && <><div className="panel-heading"><div><div className="eyebrow dark">AREA PERSONALE</div><h2>Il tuo profilo</h2><p>Registrati gratuitamente per entrare nella community.</p></div><UserCircle /></div>
            {!session ? <form className="auth-form" onSubmit={handleAuth}><div className="auth-switch"><button type="button" className={authMode === "signup" ? "selected" : ""} onClick={() => setAuthMode("signup")}>Registrati</button><button type="button" className={authMode === "login" ? "selected" : ""} onClick={() => setAuthMode("login")}>Accedi</button></div>
              {authMode === "signup" && <><label>Nickname<input required value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Es. VentoAlto" /></label><label>Regione<select value={region} onChange={e => setRegion(e.target.value)}>{["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto"].map(x => <option key={x}>{x}</option>)}</select></label></>}
              <label><span>Email</span><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.it" /></label><label>Password<input required minLength="8" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Almeno 8 caratteri" /></label>
              <button className="primary-btn full" type="submit">{authMode === "signup" ? <><Mail size={17} /> Crea account</> : "Accedi"}</button><small>La registrazione richiede la conferma dell'indirizzo email. Le password sono gestite da Supabase Auth.</small>
            </form> : <div className="profile-card"><div className="avatar large">{(profile?.nickname || "P").slice(0, 1).toUpperCase()}</div><h3>{profile?.nickname || "Pilota"}</h3><p>{profile?.region || "Italia"}</p><span className="role-label"><Shield size={14} /> {profile?.role || "pilota"}</span><p className="muted">{session.user.email}</p><button className="outline-btn" onClick={logout}>Esci dall'account</button></div>}
          </>}
          {status && <div className="notice">{status}</div>}
        </section>
        <aside className="side-panel">
          <div className="side-card dark-card"><div className="card-icon"><LocateFixed /></div><h3>Vola connesso</h3><p>Attiva il GPS quando inizi il volo. La tua posizione sarà condivisa con gli altri iscritti fino a quando terminerai la sessione.</p><div className="privacy-line"><Shield size={15} /> Condivisione volontaria</div></div>
          <div className="side-card"><h3>La piattaforma</h3><div className="feature-line"><Users /><div><b>Una community</b><span>Piloti da tutte le regioni</span></div></div><div className="feature-line"><Route /><div><b>Tracce di volo</b><span>Storico e statistiche personali</span></div></div><div className="feature-line"><Gauge /><div><b>Dati di volo</b><span>Quota, velocità e direzione GPS</span></div></div><div className="feature-line"><Clock3 /><div><b>Posizioni recenti</b><span>Le posizioni scadono dopo 2 minuti</span></div></div></div>
          <div className="side-card admin-card"><div className="card-icon pale"><Shield /></div><h3>Amministrazione</h3><p>Ruoli previsti: amministratore principale, amministratore e pilota. Solo l'amministratore principale può nominare altri amministratori.</p></div>
        </aside>
      </div>
    </main>
    <footer><span>© {new Date().getFullYear()} ParaPiloti in volo Italia by Rastafly</span><span>Prototipo tecnico · Non è un dispositivo di sicurezza aeronautica</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
