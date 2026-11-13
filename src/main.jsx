import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Wind, Map as MapIcon, Users, UserCircle, Plane, Square, LogOut, Shield, Mail, LocateFixed, Clock3, Gauge, Route, Menu, X, BookOpen, Share2, Maximize2, Trash2, CalendarDays, MapPin, Wrench } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import Equipment from "./Equipment.jsx";
import FlightAltitudeProfile from "./FlightAltitudeProfile.jsx";
const FlightTerrain3D = lazy(() => import("./FlightTerrain3D.jsx"));

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const demoPilots = [
  { id: "demo-1", nickname: "VentoAlto", region: "Veneto", lat: 45.44, lng: 12.33, altitude_m: 420, speed_kmh: 34, heading: 110, demo: true },
  { id: "demo-2", nickname: "SkyLombardia", region: "Lombardia", lat: 45.62, lng: 9.82, altitude_m: 610, speed_kmh: 28, heading: 205, demo: true },
  { id: "demo-3", nickname: "TuscanyFly", region: "Toscana", lat: 43.77, lng: 11.25, altitude_m: 530, speed_kmh: 31, heading: 80, demo: true }
];
const pilotIcon = L.divIcon({ className: "pilot-marker", html: '<div class="pilot-marker-inner"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 17 Q24 1 43 17 Q24 11 5 17Z" fill="#f6c84b" stroke="white" stroke-width="1.8"/><path d="M8 18 Q24 13 40 18" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M24 17 L24 29 M16 20 L20 31 M32 20 L28 31" stroke="white" stroke-width="1.5"/><circle cx="24" cy="31" r="3.2" fill="#fff"/><path d="M20 35 L28 35 L31 40 L17 40Z" fill="#fff" stroke="#126b59" stroke-width="1.2"/><path d="M13 33 L35 33" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg></div>', iconSize: [38, 38], iconAnchor: [19, 19] });

function FollowPilot({ ownPosition }) {
  const map = useMap();
  useEffect(() => {
    if (ownPosition) map.setView([ownPosition.lat, ownPosition.lng], map.getZoom(), { animate: true, duration: 0.5 });
  }, [ownPosition?.lat, ownPosition?.lng, map]);
  return null;
}

function CenterMapButton({ ownPosition }) {
  const map = useMap();
  if (!ownPosition) return null;
  return <button className="center-map-btn" onClick={() => map.setView([ownPosition.lat, ownPosition.lng], Math.max(map.getZoom(), 15), { animate: true })} aria-label="Centra sulla mia posizione" title="Centra sulla mia posizione"><LocateFixed size={21} /><span>CENTRA</span></button>;
}

function MapView({ pilots, ownPosition, trail, mapLayer }) {
  const center = ownPosition ? [ownPosition.lat, ownPosition.lng] : [42.8, 12.5];
  const satellite = mapLayer === "satellite";
  return <MapContainer center={center} zoom={ownPosition ? 15 : 6} scrollWheelZoom className="map">
    {satellite
      ? <TileLayer attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
      : <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />}
    {mapLayer === "aviation" && <TileLayer
      attribution='Dati aeronautici &copy; <a href="https://www.openaip.net/">OpenAIP</a>'
      url="/api/airspace-tiles?z={z}&x={x}&y={y}"
      opacity={0.88}
      maxZoom={14}
      zIndex={450}
    />}
    <FollowPilot ownPosition={ownPosition} />
    <CenterMapButton ownPosition={ownPosition} />
    {trail.length > 1 && <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: "#e05b35", weight: 2.5, opacity: 0.95, dashArray: "5 7", lineCap: "round", lineJoin: "round" }} />}
    {ownPosition?.heading != null && Number.isFinite(Number(ownPosition.heading)) && (() => {
      const bearing = Number(ownPosition.heading) * Math.PI / 180;
      const distance = 85;
      const dLat = distance * Math.cos(bearing) / 111320;
      const dLng = distance * Math.sin(bearing) / (111320 * Math.cos(ownPosition.lat * Math.PI / 180));
      const tip = [ownPosition.lat + dLat, ownPosition.lng + dLng];
      const arrowIcon = L.divIcon({ className: "heading-vector-icon", iconSize: [30, 30], iconAnchor: [15, 15], html: '<svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M15 27 L15 5 M6 14 L15 4 L24 14" fill="none" stroke="#e05b35" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
      return <><Polyline positions={[[ownPosition.lat, ownPosition.lng], tip]} pathOptions={{ color: "#e05b35", weight: 3, opacity: 1, lineCap: "round" }} /><Marker position={tip} icon={arrowIcon} interactive={false} /></>;
    })()}
    {pilots.map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={pilotIcon}><Tooltip permanent direction="top" offset={[0, -30]} opacity={1} className="pilot-name-label">{p.nickname || "Pilota"}</Tooltip><Popup><b>{p.nickname}</b><br />{p.region || "Italia"}<br />{p.altitude_m ?? "—"} m · {p.speed_kmh ?? "—"} km/h<br />Prua GPS: {p.heading == null ? "—" : Math.round(p.heading) + "° T"}{p.demo ? <><br /><small>Posizione dimostrativa</small></> : null}</Popup></Marker>)}
  </MapContainer>;
}

function FlightTrackMap({ points }) {
  const valid = (points || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
  if (valid.length < 2) return <div className="flight-map-empty">Traccia GPS non disponibile</div>;
  const coords = valid.map(p => [Number(p.lat), Number(p.lng)]);
  const bounds = L.latLngBounds(coords);
  return <MapContainer bounds={bounds} boundsOptions={{ padding: [18,18] }} scrollWheelZoom={false} dragging={false} zoomControl={false} doubleClickZoom={false} touchZoom={false} className="flight-track-map">
    <TileLayer attribution='Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" />
    <Polyline positions={coords} pathOptions={{color:"#f36a2c",weight:3,dashArray:"7 8",lineCap:"round",lineJoin:"round",opacity:0.95}} />
  </MapContainer>;
}

class TerrainErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("PILOT ADVISOR terrain viewer:", error); }
  render() {
    if (this.state.error) return <div className="terrain-3d-notice"><b>La mappa 3D non è riuscita ad avviarsi.</b><p>{this.state.error.message || "Errore del visualizzatore."}</p><button type="button" className="outline-btn" onClick={() => this.setState({ error: null })}>Riprova 3D</button></div>;
    return this.props.children;
  }
}

// Demo locale: nessun inserimento in Supabase e nessuna posizione condivisa.
function createDemoFlight() {
  const start = new Date("2026-11-13T10:00:00+01:00");
  const anchors = [
    [46.0184, 11.9070, 340], // Feltre
    [46.0302, 11.9240, 1050],
    [46.0430, 11.9470, 1550],
    [46.0520, 11.9720, 2050],
    [46.0460, 11.9940, 2350],
    [46.0310, 12.0030, 1950],
    [46.0130, 11.9810, 1350],
    [46.0070, 11.9470, 800],
    [46.0184, 11.9070, 340]
  ];
  const points = [];
  const steps = 12;
  for (let segment = 0; segment < anchors.length - 1; segment++) {
    const [latA, lngA, altA] = anchors[segment];
    const [latB, lngB, altB] = anchors[segment + 1];
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const smooth = t * t * (3 - 2 * t);
      const elapsed = (segment * steps + i) * 25_000;
      points.push({
        lat: latA + (latB - latA) * smooth,
        lng: lngA + (lngB - lngA) * smooth,
        altitude_m: Math.round(altA + (altB - altA) * smooth),
        recorded_at: new Date(start.getTime() + elapsed).toISOString()
      });
    }
  }
  points.push({ lat: anchors.at(-1)[0], lng: anchors.at(-1)[1], altitude_m: 340, recorded_at: new Date(start.getTime() + (anchors.length - 1) * steps * 25_000).toISOString() });
  return {
    id: "demo-feltre-3d", demo: true, started_at: start.toISOString(),
    ended_at: points.at(-1).recorded_at,
    avg_speed_kmh: 38.5, max_speed_kmh: 57.2, min_speed_kmh: 12.4,
    fuel_consumed_l: 2.6, points
  };
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
  const [mapLayer, setMapLayer] = useState("street");
  const [pilots, setPilots] = useState(demoPilots);
  const [flying, setFlying] = useState(false);
  const [ownPosition, setOwnPosition] = useState(null);
  const [trail, setTrail] = useState([]);
  const [currentFlightId, setCurrentFlightId] = useState(null);
  const [logbook, setLogbook] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightMapMode, setFlightMapMode] = useState("2d");
  const [selectedTrackPoint, setSelectedTrackPoint] = useState(null);
  const [logbookLoading, setLogbookLoading] = useState(false);
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
    loadLogbook();
  }, [session]);

  async function saveTrackPoint(flightId, position) {
    const base = { flight_session_id: flightId, pilot_id: session.user.id, lat: position.lat, lng: position.lng };
    const withAltitude = { ...base, altitude_m: position.altitude_m == null ? null : Number(position.altitude_m) };
    let result = await supabase.from("flight_track_points").insert(withAltitude);
    // Compatibility with databases not yet migrated: never lose the GPS track.
    if (result.error && /altitude_m|schema cache|column/i.test(result.error.message || "")) {
      result = await supabase.from("flight_track_points").insert(base);
    }
    return result;
  }

  async function loadLogbook() {
    if (!supabase || !session) return;
    setLogbookLoading(true);
    const { data, error } = await supabase.from("flight_sessions").select("id,pilot_id,started_at,ended_at,avg_speed_kmh,max_speed_kmh,min_speed_kmh,fuel_consumed_l,equipment_snapshot").eq("pilot_id", session.user.id).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(50);
    if (error) { setStatus("Impossibile caricare il logbook: " + error.message); setLogbookLoading(false); return; }
    const ids = (data || []).map(f => f.id);
    let points = [];
    if (ids.length) {
      let result = await supabase.from("flight_track_points").select("flight_session_id,lat,lng,altitude_m,recorded_at").in("flight_session_id", ids).order("recorded_at", { ascending: true });
      if (result.error && /altitude_m|schema cache|column/i.test(result.error.message || "")) {
        result = await supabase.from("flight_track_points").select("flight_session_id,lat,lng,recorded_at").in("flight_session_id", ids).order("recorded_at", { ascending: true });
      }
      if (result.error) setStatus("Tracce non disponibili: " + result.error.message);
      else points = result.data || [];
    }
    setLogbook((data || []).map(f => ({ ...f, points: points.filter(p => p.flight_session_id === f.id) })));
    setLogbookLoading(false);
  }

  async function deleteFlight(flight) {
    const dateLabel = new Date(flight.started_at).toLocaleDateString("it-IT");
    if (!window.confirm(`Vuoi eliminare definitivamente il volo del ${dateLabel} e la relativa traccia GPS? L'operazione non si può annullare.`)) return;
    if (!supabase || !session) return;
    const { error } = await supabase.from("flight_sessions").delete().eq("id", flight.id).eq("pilot_id", session.user.id);
    if (error) {
      setStatus("Impossibile eliminare il volo: " + error.message);
      return;
    }
    setLogbook(current => current.filter(item => item.id !== flight.id));
    setSelectedFlight(current => current?.id === flight.id ? null : current);
    setStatus("Volo e traccia GPS eliminati dal logbook.");
  }

  function flightGpx(flight) {
    const points = (flight.points || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
    const track = points.map(p => `      <trkpt lat="${Number(p.lat)}" lon="${Number(p.lng)}"><time>${new Date(p.recorded_at || flight.started_at).toISOString()}</time></trkpt>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="PILOT ADVISOR · RASTA7212" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Volo ParaPiloti Italia</name><time>${new Date(flight.started_at).toISOString()}</time></metadata><trk><name>Traccia GPS</name><trkseg>\n${track}\n    </trkseg></trk></gpx>`;
  }

  function exportFlightGpx(flight) {
    const points = flight.points || [];
    if (points.length < 2) { setStatus("Non ci sono abbastanza punti GPS per esportare la traccia."); return; }
    const blob = new Blob([flightGpx(flight)], { type: "application/gpx+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `parapiloti-volo-${new Date(flight.started_at).toISOString().slice(0,10)}.gpx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Traccia GPX esportata.");
  }

  async function shareFlight(flight) {
    const durationMs = Math.max(0, new Date(flight.ended_at) - new Date(flight.started_at));
    const mins = Math.floor(durationMs / 60000);
    const duration = `${String(Math.floor(mins / 60)).padStart(2,"0")}:${String(mins % 60).padStart(2,"0")}`;
    const date = new Date(flight.started_at).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
    const points = (flight.points || []).length;
    const message = `Il mio volo con ParaPiloti Italia 🪂\nData: ${date}\nDurata: ${duration}\nPunti GPS: ${points}\nTraccia in formato GPX allegata quando supportato.\nCreated by RASTA7212`;
    try {
      const gpx = new File([flightGpx(flight)], `parapiloti-volo-${new Date(flight.started_at).toISOString().slice(0,10)}.gpx`, { type: "application/gpx+xml" });
      if (navigator.share && navigator.canShare?.({ files: [gpx] })) {
        await navigator.share({ title: "Il mio volo · ParaPiloti Italia", text: message, files: [gpx] });
      } else if (navigator.share) {
        await navigator.share({ title: "Il mio volo · ParaPiloti Italia", text: message });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setStatus("Riepilogo copiato. Puoi esportare la traccia GPX dal dettaglio del volo.");
      } else setStatus(message);
    } catch (e) { if (e.name !== "AbortError") setStatus("Condivisione non disponibile su questo dispositivo."); }
  }

  async function refreshPilots() {
    if (!supabase) return;
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("live_positions").select("user_id,latitude,longitude,altitude_m,speed_kmh,heading,updated_at,profiles(nickname,region)").gte("updated_at", cutoff);
    if (error) { setStatus(error.message); return; }
    setPilots((data || []).map(p => ({ id: p.user_id, lat: p.latitude, lng: p.longitude, altitude_m: p.altitude_m, speed_kmh: p.speed_kmh, heading: p.heading, nickname: p.profiles?.nickname || "Pilota", region: p.profiles?.region })));
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
    setFlying(false); setOwnPosition(null); setTrail([]);
  }

  async function startFlight() {
    if (!session) { setStatus("Accedi o registrati prima di avviare un volo."); setTab("profile"); return; }
    if (!navigator.geolocation) { setGpsError("Geolocalizzazione non supportata da questo dispositivo."); return; }
    setGpsError("");
    navigator.geolocation.getCurrentPosition(async pos => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, altitude_m: pos.coords.altitude == null ? null : Math.round(pos.coords.altitude), speed_kmh: pos.coords.speed == null ? null : Math.round(pos.coords.speed * 3.6), heading: pos.coords.heading, updated_at: new Date().toISOString() };
      setOwnPosition(p); setTrail([{lat:p.lat,lng:p.lng,time:Date.now()}]); setFlying(true); setStatus("Sessione avviata. Mantieni l'app autorizzata alla posizione.");
      window.__flightStartedAt = Date.now(); window.__flightSpeeds = p.speed_kmh == null ? [] : [p.speed_kmh]; window.__flightFuelRate = 0; window.__flightEquipmentSnapshot = {};
      const { data: gear } = await supabase.from("pilot_equipment").select("category,name,model,consumption_lph").eq("user_id", session.user.id).order("created_at", { ascending: true });
      const paramotor = (gear || []).find(x => x.category === "Paramotore");
      if (paramotor) { window.__flightFuelRate = Number(paramotor.consumption_lph) || 0; window.__flightEquipmentSnapshot = paramotor; }
      await publishPosition(p);
      const { data: flightSession, error } = await supabase.from("flight_sessions").insert({ pilot_id: profile?.id || session.user.id, equipment_snapshot: window.__flightEquipmentSnapshot }).select("id").single();
      if (error || !flightSession) { setStatus("Posizione inviata, ma apertura del logbook non riuscita: " + (error?.message || "sessione non creata")); return; }
      const activeFlightId = flightSession.id;
      setCurrentFlightId(activeFlightId);
      await saveTrackPoint(activeFlightId, p);
      window.__lastSavedTrackPoint = { lat: p.lat, lng: p.lng, time: Date.now() };
      window.__flightWatch = navigator.geolocation.watchPosition(async next => {
        const q = { lat: next.coords.latitude, lng: next.coords.longitude, altitude_m: next.coords.altitude == null ? null : Math.round(next.coords.altitude), speed_kmh: next.coords.speed == null ? null : Math.round(next.coords.speed * 3.6), heading: next.coords.heading, accuracy_m: next.coords.accuracy, updated_at: new Date().toISOString() };
        setOwnPosition(q);
        if (q.speed_kmh != null && q.speed_kmh >= 0) window.__flightSpeeds = [...(window.__flightSpeeds || []), q.speed_kmh];
        setTrail(prev => {
          const now = Date.now();
          const recent = prev.filter(point => now - point.time <= 60000);
          const last = recent[recent.length - 1];
          if (next.coords.accuracy > 35) return recent;
          if (last) {
            const rad = Math.PI / 180;
            const dLat = (q.lat - last.lat) * 111320;
            const dLng = (q.lng - last.lng) * 111320 * Math.cos(last.lat * rad);
            const distance = Math.hypot(dLat, dLng);
            const elapsed = Math.max(0.5, (now - last.time) / 1000);
            const gpsSpeed = next.coords.speed;
            // Ignore stationary GPS drift and implausible position jumps.
            if (distance < 4 || (gpsSpeed != null && gpsSpeed < 1.5 && distance < 12)) return recent;
            if (distance / elapsed > 45) return recent;
          }
          return [...recent, {lat:q.lat,lng:q.lng,time:now}];
        });
        const accuracyOk = next.coords.accuracy <= 35;
        const lastSaved = window.__lastSavedTrackPoint;
        const radSaved = Math.PI / 180;
        const dLatSaved = lastSaved ? (q.lat - lastSaved.lat) * 111320 : 0;
        const dLngSaved = lastSaved ? (q.lng - lastSaved.lng) * 111320 * Math.cos(lastSaved.lat * radSaved) : 0;
        const movedMeters = Math.hypot(dLatSaved, dLngSaved);
        const moving = next.coords.speed != null ? next.coords.speed >= 1.5 : movedMeters >= 15;
        if (accuracyOk && moving && movedMeters >= 5) {
          const { error: pointError } = await saveTrackPoint(activeFlightId, q);
          if (!pointError) window.__lastSavedTrackPoint = { lat: q.lat, lng: q.lng, time: Date.now() };
        }
        await publishPosition(q);
      }, err => setGpsError(err.message), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }, err => setGpsError(err.message), { enableHighAccuracy: true, timeout: 20000 });
  }

  async function publishPosition(p) {
    if (!supabase || !session) return;
    const { error } = await supabase.from("live_positions").upsert({ pilot_id: profile?.id || session.user.id, user_id: session.user.id, latitude: p.lat, longitude: p.lng, altitude_m: p.altitude_m, speed_kmh: p.speed_kmh, heading: p.heading, updated_at: p.updated_at }, { onConflict: "pilot_id" });
    if (error) setStatus("Errore invio posizione: " + error.message);
    else refreshPilots();
  }

  async function stopFlight() {
    if (window.__flightWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(window.__flightWatch);
    window.__flightWatch = null; window.__lastSavedTrackPoint = null; setFlying(false); setOwnPosition(null);
    if (supabase && session) {
      await supabase.from("live_positions").delete().eq("user_id", session.user.id);
      if (currentFlightId) {
        const endedAt = Date.now();
        const startedAt = window.__flightStartedAt || endedAt;
        const durationHours = Math.max(0, (endedAt - startedAt) / 3600000);
        const speeds = (window.__flightSpeeds || []).filter(v => Number.isFinite(Number(v))).map(Number);
        const stats = speeds.length ? { avg_speed_kmh: speeds.reduce((a,b) => a+b,0) / speeds.length, max_speed_kmh: Math.max(...speeds), min_speed_kmh: Math.min(...speeds) } : {};
        const fuel = durationHours * (Number(window.__flightFuelRate) || 0);
        const { error } = await supabase.from("flight_sessions").update({ ended_at: new Date(endedAt).toISOString(), ...stats, fuel_consumed_l: fuel }).eq("id", currentFlightId).eq("pilot_id", session.user.id);
        if (error) setStatus("Volo terminato, ma statistiche non salvate: " + error.message);
      }
    }
    window.__flightStartedAt = null; window.__flightSpeeds = []; window.__flightFuelRate = 0; window.__flightEquipmentSnapshot = {};
    setCurrentFlightId(null);
    setStatus("Volo terminato e salvato nel tuo logbook.");
    loadLogbook();
    refreshPilots();
  }

  const activePilots = pilots.filter(p => !p.demo).length;
  return <div className={flying ? "app-shell flight-mode" : "app-shell"}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark" aria-label="Pilot-Advisor"><svg viewBox="0 0 64 64" role="img" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#0b2032" stroke="#d9edf7" strokeWidth="2"/><circle cx="32" cy="32" r="22" fill="none" stroke="#55b8e6" strokeWidth="1.5" strokeDasharray="3 3"/><path d="M10 25 Q32 5 54 25 Q32 17 10 25Z" fill="#f8fbfd" stroke="#55b8e6" strokeWidth="1.5"/><path d="M17 26L32 43L47 26M32 27V48" fill="none" stroke="#f8fbfd" strokeWidth="1.8" strokeLinecap="round"/><path d="M32 13V7M51 32H57M32 51V57M7 32H13" stroke="#83c9ed" strokeWidth="2" strokeLinecap="round"/><path d="M32 29L36 36L32 34L28 36Z" fill="#83c9ed"/></svg></div><div className="brand-wordmark"><strong>PILOT <span>ADVISOR</span></strong><small className="brand-creator">BY RASTA7212</small></div></div>
      <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X /> : <Menu />}</button>
      <nav className={menuOpen ? "nav open" : "nav"}>
        <button className={tab === "map" ? "nav-active" : ""} onClick={() => { setTab("map"); setMenuOpen(false); }}><MapIcon size={17} /> Live GPS</button>
        <button className={tab === "pilots" ? "nav-active" : ""} onClick={() => { setTab("pilots"); setMenuOpen(false); }}><Users size={17} /> Community</button>
        <button className={tab === "profile" ? "nav-active" : ""} onClick={() => { setTab("profile"); setMenuOpen(false); }}><UserCircle size={17} /> Profilo</button>
        <button className={tab === "logbook" ? "nav-active" : ""} onClick={() => { setTab("logbook"); setMenuOpen(false); loadLogbook(); }}><BookOpen size={17} /> Logbook</button>
        <button className={tab === "equipment" ? "nav-active" : ""} onClick={() => { setTab("equipment"); setMenuOpen(false); }}><Wrench size={17} /> Tecnica</button>
      </nav>
      <div className="header-right">{session ? <><span className="signed-in">{profile?.nickname || session.user.email}</span><button className="icon-btn" onClick={logout} title="Esci"><LogOut size={18} /></button></> : <button className="small-primary" onClick={() => setTab("profile")}>Accedi</button>}</div>
    </header>
    <main>
      <section className="hero">
        <div><div className="eyebrow"><span className="pulse"></span> FLIGHT MANAGEMENT SYSTEM</div><h1>La tua cabina di pilotaggio<br /><em>digitale, sempre con te.</em></h1><p>GPS live, diario di volo, statistiche e gestione dell’attrezzatura: tutto ciò che serve al pilota, in un’unica piattaforma.</p></div>
        <div className="hero-stats"><div><b>{configured ? activePilots : "—"}</b><span>Piloti live</span></div><div><b>{configured ? "Online" : "Demo"}</b><span>Stato piattaforma</span></div></div>
      </section>
      <div className="content-grid">
        <section className="main-panel">
          {tab === "map" && <><div className="panel-heading"><div><div className="eyebrow dark">LIVE FLIGHT TRACKING</div><h2>Situazione in volo</h2><p>Le posizioni reali sono visibili solo agli utenti autenticati.</p></div><span className="live-pill"><i></i> LIVE</span></div>
            <div className="map-wrap">
              <div className="map-layer-controls" role="group" aria-label="Tipo di mappa">
                <button type="button" className={mapLayer === "street" ? "active" : ""} onClick={() => setMapLayer("street")}><MapIcon size={15} /> Stradale</button>
                <button type="button" className={mapLayer === "satellite" ? "active" : ""} onClick={() => setMapLayer("satellite")}><MapPin size={15} /> Satellite</button>
                <button type="button" className={mapLayer === "aviation" ? "active" : ""} onClick={() => setMapLayer("aviation")}><Plane size={15} /> Aeronautica</button>
              </div>
              <MapView key={flying ? "flight-map" : "normal-map"} pilots={pilots} ownPosition={ownPosition} trail={trail} mapLayer={mapLayer} />
              
              <div className="map-legend"><span><i className="legend-dot green"></i> Piloti attivi</span><span><i className="legend-dot blue"></i> La tua posizione</span></div>
            </div>
            <div className="flight-control"><div><b>{flying ? "Sessione di volo attiva" : "Pronto al decollo?"}</b><span>{flying ? "La posizione viene condivisa con gli iscritti." : "Avvia la condivisione quando sei pronto."}</span></div><button className={flying ? "danger-btn" : "primary-btn"} onClick={flying ? stopFlight : startFlight}>{flying ? <Square size={17} /> : <Plane size={17} />} {flying ? "Termina volo" : "Avvia il mio volo"}</button></div>
            {gpsError && <div className="notice error">{gpsError}</div>}
          </>}
          {tab === "pilots" && <><div className="panel-heading"><div><div className="eyebrow dark">COMMUNITY</div><h2>Piloti in volo</h2><p>Elenco delle posizioni aggiornate di recente.</p></div><Users /></div>{pilots.map(p => <div className="pilot-row" key={p.id}><div className="avatar">{p.nickname?.slice(0, 1)?.toUpperCase() || "P"}</div><div className="pilot-info"><b>{p.nickname}</b><span>{p.region || "Italia"} · {p.demo ? "Posizione demo" : "In volo"}</span></div><div className="pilot-data"><b>{p.altitude_m ?? "—"} m</b><span>{p.speed_kmh ?? "—"} km/h</span></div><span className="status-dot"></span></div>)}</>}
          {tab === "logbook" && <><div className="panel-heading"><div><div className="eyebrow dark">DIARIO DI BORDO</div><h2>Il mio logbook</h2><p>Ogni volo concluso viene conservato qui, con orario e traccia GPS.</p></div><BookOpen /></div><div className="logbook-demo-panel"><div><b>Prova la mappa 3D dal Mac</b><span>Volo simulato sulle Prealpi Bellunesi · dati di prova, non salvati tra i voli reali</span></div><button type="button" className="primary-btn" onClick={() => { setFlightMapMode("3d"); setSelectedTrackPoint(null); setSelectedFlight(createDemoFlight()); }}>Apri volo demo 3D</button></div>
            {!session ? <div className="notice">Accedi per consultare e conservare il tuo diario di volo.</div> : logbookLoading ? <p>Caricamento voli...</p> : logbook.length === 0 ? <div className="empty-logbook"><Plane size={30}/><b>Il tuo primo volo ti aspetta</b><span>Quando terminerai una sessione GPS, il riepilogo apparirà qui.</span></div> : <div className="logbook-list">{logbook.map(f => {
              const pts = f.points || [];
              const start = new Date(f.started_at);
              const end = new Date(f.ended_at);
              const durationMs = Math.max(0, end - start);
              const mins = Math.floor(durationMs / 60000);
              const duration = `${String(Math.floor(mins / 60)).padStart(2,"0")}:${String(mins % 60).padStart(2,"0")}`;
              return <article className="flight-log-card" key={f.id} onClick={() => { setFlightMapMode("2d"); setSelectedTrackPoint(null); setSelectedFlight(f); }}>
                <div className="flight-log-map"><FlightTrackMap points={pts} /></div>
                <div className="flight-log-details"><b>{start.toLocaleDateString("it-IT", { day:"2-digit", month:"long", year:"numeric" })}</b><span><Clock3 size={14}/> {start.toLocaleTimeString("it-IT", {hour:"2-digit",minute:"2-digit"})} · {duration}</span><small><MapPin size={13}/> {pts.length} punti GPS · {f.avg_speed_kmh != null ? Number(f.avg_speed_kmh).toFixed(1) + " km/h media" : "velocità n/d"} · {f.fuel_consumed_l != null ? Number(f.fuel_consumed_l).toFixed(1) + " L stimati" : "carburante n/d"}</small></div>
                <button className="log-share" onClick={e => { e.stopPropagation(); shareFlight(f); }} aria-label="Condividi volo"><Share2 size={18}/></button>
                <button className="log-expand" onClick={e => { e.stopPropagation(); setFlightMapMode("2d"); setSelectedFlight(f); }} aria-label="Apri dettaglio"><Maximize2 size={17}/></button>
                <button className="log-delete" onClick={e => { e.stopPropagation(); deleteFlight(f); }} aria-label="Elimina volo" title="Elimina volo"><Trash2 size={17}/></button>
              </article>;
            })}</div>}
          </>}
          {tab === "equipment" && <Equipment supabase={supabase} userId={session?.user?.id} onStatus={setStatus} />}
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
    {selectedFlight && <div className="flight-modal-backdrop" onClick={() => setSelectedFlight(null)}><section className="flight-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setSelectedFlight(null)} aria-label="Chiudi">×</button>
      <div className="eyebrow dark">PILOT ADVISOR · BY RASTA7212</div><h2>{selectedFlight.demo ? "Volo dimostrativo · Feltre" : "Il mio volo"}</h2>{selectedFlight.demo && <p className="demo-flight-label">SIMULAZIONE · Nessun volo reale registrato · Nessun dato aggiunto al tuo account</p>}
      <b>{new Date(selectedFlight.started_at).toLocaleDateString("it-IT", { dateStyle:"full" })}</b>
      <p>{new Date(selectedFlight.started_at).toLocaleTimeString("it-IT", {hour:"2-digit",minute:"2-digit"})} – {new Date(selectedFlight.ended_at).toLocaleTimeString("it-IT", {hour:"2-digit",minute:"2-digit"})}</p>
      <div className="flight-view-switch" role="group" aria-label="Visualizzazione della traccia">
        <button type="button" className={flightMapMode === "2d" ? "active" : ""} onClick={() => setFlightMapMode("2d")}>Mappa 2D</button>
        <button type="button" className={flightMapMode === "3d" ? "active" : ""} onClick={() => setFlightMapMode("3d")}>Terreno 3D</button>
      </div>
      <div className={flightMapMode === "3d" ? "flight-modal-map flight-modal-map-3d" : "flight-modal-map"}>
        {flightMapMode === "3d" ? <TerrainErrorBoundary><Suspense fallback={<div className="flight-map-empty">Caricamento terreno 3D...</div>}><FlightTerrain3D points={selectedFlight.points || []} activeIndex={selectedTrackPoint}/></Suspense></TerrainErrorBoundary> : <FlightTrackMap points={selectedFlight.points || []}/>}
      </div>
      <FlightAltitudeProfile points={selectedFlight.points || []} activeIndex={selectedTrackPoint} onSelect={setSelectedTrackPoint}/>
      <div className="flight-modal-stats"><span><small>DURATA</small><b>{String(Math.floor((new Date(selectedFlight.ended_at)-new Date(selectedFlight.started_at))/3600000)).padStart(2,"0")}:{String(Math.floor(((new Date(selectedFlight.ended_at)-new Date(selectedFlight.started_at))%3600000)/60000)).padStart(2,"0")}</b></span><span><small>PUNTI GPS</small><b>{(selectedFlight.points || []).length}</b></span><span><small>MEDIA GPS</small><b>{selectedFlight.avg_speed_kmh == null ? "—" : Number(selectedFlight.avg_speed_kmh).toFixed(1) + " km/h"}</b></span><span><small>MAX GPS</small><b>{selectedFlight.max_speed_kmh == null ? "—" : Number(selectedFlight.max_speed_kmh).toFixed(1) + " km/h"}</b></span><span><small>MIN GPS</small><b>{selectedFlight.min_speed_kmh == null ? "—" : Number(selectedFlight.min_speed_kmh).toFixed(1) + " km/h"}</b></span><span><small>CARBURANTE STIMATO</small><b>{selectedFlight.fuel_consumed_l == null ? "—" : Number(selectedFlight.fuel_consumed_l).toFixed(1) + " L"}</b></span></div>
      {!selectedFlight.demo && <button className="primary-btn full" onClick={() => shareFlight(selectedFlight)}><Share2 size={17}/> Condividi volo e traccia</button>}
      <button className="outline-btn full" onClick={() => exportFlightGpx(selectedFlight)}><Route size={17}/> Esporta traccia GPX</button>
      {!selectedFlight.demo && <button className="log-delete-modal full" onClick={() => deleteFlight(selectedFlight)}><Trash2 size={17}/> Elimina questo volo</button>}
      <small className="muted">La traccia è un riepilogo GPS indicativo, non uno strumento di navigazione.</small>
    </section></div>}
    <footer><span>© {new Date().getFullYear()} PILOT ADVISOR · RASTA7212</span><span>Prototipo tecnico · Non è un dispositivo di sicurezza aeronautica</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
