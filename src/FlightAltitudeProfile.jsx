import React, { useMemo } from "react";

const radians = Math.PI / 180;
function distanceMeters(a, b) {
  const lat1 = Number(a.lat) * radians, lat2 = Number(b.lat) * radians;
  const dLat = lat2 - lat1, dLng = (Number(b.lng) - Number(a.lng)) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function smoothPath(data) {
  if (data.length < 2) return "";
  let path = `M ${data[0].x.toFixed(2)} ${data[0].y.toFixed(2)}`;
  // Monotone cubic Hermite interpolation: smooth, without artificial overshoots.
  const slopes = data.slice(1).map((p, i) => (p.y - data[i].y) / Math.max(0.0001, p.x - data[i].x));
  const tangents = data.map((p, i) => {
    if (i === 0) return slopes[0];
    if (i === data.length - 1) return slopes[slopes.length - 1];
    if (slopes[i - 1] * slopes[i] <= 0) return 0;
    return 2 / (1 / slopes[i - 1] + 1 / slopes[i]);
  });
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i], b = data[i + 1], dx = b.x - a.x;
    path += ` C ${(a.x + dx / 3).toFixed(2)} ${(a.y + tangents[i] * dx / 3).toFixed(2)}, ${(b.x - dx / 3).toFixed(2)} ${(b.y - tangents[i + 1] * dx / 3).toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }
  return path;
}

export default function FlightAltitudeProfile({ points, activeIndex, onSelect }) {
  const data = useMemo(() => {
    let total = 0;
    return (points || []).map((p, i, all) => {
      if (i) total += distanceMeters(all[i - 1], p);
      const altitude = p.altitude_m == null ? null : Number(p.altitude_m);
      return { ...p, index: i, km: total / 1000, altitude: Number.isFinite(altitude) ? altitude : null };
    }).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
  }, [points]);
  const known = data.filter(p => p.altitude !== null);
  if (known.length < 2) return <div className="altitude-profile-empty"><b>Profilo altimetrico non disponibile</b><span>Per i nuovi voli occorre registrare la quota GPS in ogni punto. Le vecchie tracce senza quota restano consultabili in 2D e 3D sul terreno.</span></div>;
  const W = 780, H = 250, left = 56, right = 24, top = 26, bottom = 40;
  const minAlt = Math.min(...known.map(p => p.altitude));
  const maxAlt = Math.max(...known.map(p => p.altitude));
  const padding = Math.max(45, (maxAlt - minAlt) * .12);
  const floor = Math.max(0, Math.floor((minAlt - padding) / 100) * 100);
  const ceil = Math.ceil((maxAlt + padding) / 100) * 100 || floor + 100;
  const maxKm = Math.max(0.1, data.at(-1)?.km || 0.1);
  const x = km => left + (km / maxKm) * (W - left - right);
  const y = alt => top + (1 - (alt - floor) / (ceil - floor)) * (H - top - bottom);
  const coords = known.map(p => ({ x: x(p.km), y: y(p.altitude) }));
  const path = smoothPath(coords);
  const fillPath = path + ` L ${coords.at(-1).x.toFixed(2)} ${H - bottom} L ${coords[0].x.toFixed(2)} ${H - bottom} Z`;
  const peak = known.reduce((best, p) => p.altitude > best.altitude ? p : best, known[0]);
  const highlighted = activeIndex == null ? null : data.find(p => p.index === activeIndex && p.altitude !== null);
  const handleMove = event => {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const nearest = known.reduce((best, p) => Math.abs(x(p.km) - px) < Math.abs(x(best.km) - px) ? p : best, known[0]);
    onSelect(nearest.index);
  };
  const ticks = Array.from({ length: 5 }, (_, i) => floor + (ceil - floor) * i / 4);
  return <section className="altitude-profile">
    <div className="altitude-profile-header"><div><b>Profilo altimetrico</b><span>Quota GPS sul livello del mare · distanza dal decollo</span></div><strong>{Math.round(maxAlt)} m <small>quota massima</small></strong></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafico altimetrico continuo della quota lungo il percorso" onMouseMove={handleMove} onClick={handleMove}>
      <defs><linearGradient id="flight-altitude-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#367e89" stopOpacity=".86"/><stop offset="100%" stopColor="#eaf4f1" stopOpacity=".16"/></linearGradient></defs>
      {ticks.map((t,i) => <g key={i}><line x1={left} x2={W-right} y1={y(t)} y2={y(t)} stroke="#c6d0d3" strokeWidth="1"/><text x={left-8} y={y(t)+4} textAnchor="end" fontSize="12" fill="#5e7481">{Math.round(t)} m</text></g>)}
      <path d={fillPath} fill="url(#flight-altitude-fill)"/>
      <path d={path} fill="none" stroke="#27727f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {[known[0], peak, known.at(-1)].map((p,i) => <g key={i}><circle cx={x(p.km)} cy={y(p.altitude)} r="4.5" fill="#155967"/><text x={x(p.km)} y={Math.max(14,y(p.altitude)-12)} textAnchor="middle" fontSize="13" fill="#1a4052" fontWeight="700">{Math.round(p.altitude)} m</text></g>)}
      {highlighted && <g><line x1={x(highlighted.km)} x2={x(highlighted.km)} y1={top} y2={H-bottom} stroke="#f36a2c" strokeDasharray="4 5" strokeWidth="2"/><circle cx={x(highlighted.km)} cy={y(highlighted.altitude)} r="6" fill="#f36a2c" stroke="white" strokeWidth="2"/></g>}
      <line x1={left} x2={W-right} y1={H-bottom} y2={H-bottom} stroke="#8296a0"/>
      {Array.from({length:5},(_,i)=>i).map(i => <text key={i} x={x(maxKm*i/4)} y={H-14} textAnchor="middle" fontSize="12" fill="#5e7481">{(maxKm*i/4).toFixed(1)} km</text>)}
    </svg>
    <div className="altitude-profile-footer"><span>Decollo: <b>{Math.round(known[0].altitude)} m</b></span><span>Atterraggio: <b>{Math.round(known.at(-1).altitude)} m</b></span><span>Distanza: <b>{maxKm.toFixed(1)} km</b></span>{highlighted && <span>Selezione: <b>{Math.round(highlighted.altitude)} m · {highlighted.km.toFixed(1)} km</b></span>}</div>
    <small>Passa il mouse sul grafico per individuare il punto corrispondente sulla mappa 3D. Curva interpolata senza picchi artificiali; i valori derivano dai punti GPS registrati.</small>
  </section>;
}
