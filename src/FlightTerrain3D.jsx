import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TOPO_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";

function boundsFor(points) {
  const lngs = points.map(p => Number(p.lng));
  const lats = points.map(p => Number(p.lat));
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

function flightRibbon(points, map) {
  const features = [];
  for (let i = 0; i < points.length - 1; i += 2) {
    const a = points[i], b = points[Math.min(i + 1, points.length - 1)];
    if (a.altitude_m == null || b.altitude_m == null) continue;
    const groundA = map.queryTerrainElevation([Number(a.lng), Number(a.lat)], { exaggerated: false });
    const groundB = map.queryTerrainElevation([Number(b.lng), Number(b.lat)], { exaggerated: false });
    if (!Number.isFinite(groundA) || !Number.isFinite(groundB)) continue;
    const agl = Math.max(3, (Number(a.altitude_m) - groundA + Number(b.altitude_m) - groundB) / 2);
    const midLat = (Number(a.lat) + Number(b.lat)) / 2;
    const cosLat = Math.max(0.1, Math.cos(midLat * Math.PI / 180));
    const dx = (Number(b.lng) - Number(a.lng)) * cosLat, dy = Number(b.lat) - Number(a.lat);
    const norm = Math.hypot(dx, dy);
    if (norm < 1e-10) continue;
    const width = 7 / 111320;
    const ox = (-dy / norm) * width / cosLat, oy = (dx / norm) * width;
    const corners = [
      [Number(a.lng) + ox, Number(a.lat) + oy],
      [Number(b.lng) + ox, Number(b.lat) + oy],
      [Number(b.lng) - ox, Number(b.lat) - oy],
      [Number(a.lng) - ox, Number(a.lat) - oy]
    ];
    features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...corners, corners[0]]] }, properties: { base: Math.max(0, agl - 4), top: agl } });
  }
  return { type: "FeatureCollection", features };
}

export default function FlightTerrain3D({ points, activeIndex }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [message, setMessage] = useState("");
  const valid = (points || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180);

  useEffect(() => {
    if (!container.current || valid.length < 2) return;
    if (typeof maplibregl.supported === "function" && !maplibregl.supported()) {
      setMessage("La visualizzazione 3D richiede WebGL, non disponibile su questo dispositivo.");
      return;
    }
    const coords = valid.map(p => [Number(p.lng), Number(p.lat)]);
    let map;
    try {
    map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          topo: { type: "raster", tiles: [TOPO_URL], tileSize: 256, attribution: "Tiles © Esri, HERE, Garmin, OpenStreetMap contributors" },
          terrain: { type: "raster-dem", tiles: [TERRAIN_URL], tileSize: 256, maxzoom: 15, encoding: "terrarium", attribution: "Terrain DEM: AWS Terrain Tiles" }
        },
        layers: [{ id: "base-map", type: "raster", source: "topo" }],
        // Activate the DEM after the style is ready, to avoid startup errors.
      },
      center: coords[0],
      zoom: 11,
      pitch: 65,
      bearing: -25,
      antialias: false,
      attributionControl: true
    });
    } catch (error) {
      setMessage("Impossibile avviare il motore 3D: " + (error?.message || "errore sconosciuto"));
      return;
    }
    mapRef.current = map;
    map.scrollZoom.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      try {
        if (typeof map.setTerrain === "function") map.setTerrain({ source: "terrain", exaggeration: 1.35 });
      } catch (error) { setMessage("Il terreno 3D non è disponibile su questo browser: " + error.message); }
      try {
      map.addSource("flight-path", { type: "geojson", data: {
        type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {}
      }});
      map.addLayer({ id: "flight-path-line", type: "line", source: "flight-path", paint: {
        "line-color": "#f36a2c", "line-width": 3.5, "line-opacity": 0.98, "line-dasharray": [2.5, 2.5]
      }, layout: { "line-cap": "round", "line-join": "round" }});
      map.addSource("flight-airborne", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "flight-airborne-ribbon", type: "fill-extrusion", source: "flight-airborne",
        paint: { "fill-extrusion-color": "#f36a2c", "fill-extrusion-opacity": 0.94,
          "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"] } });
      let ribbonReady = false;
      const updateElevated = () => {
        if (ribbonReady) return;
        try {
          const ribbon = flightRibbon(valid, map);
          if (ribbon.features.length) { ribbonReady = true; map.getSource("flight-airborne")?.setData(ribbon); }
        } catch (error) { console.warn("3D flight ribbon:", error); }
      };
      map.once("idle", updateElevated);
      updateElevated();
      new maplibregl.Marker({ color: "#13a879" }).setLngLat(coords[0]).addTo(map);
      new maplibregl.Marker({ color: "#d9473e" }).setLngLat(coords[coords.length - 1]).addTo(map);
      map.fitBounds(boundsFor(valid), { padding: 75, maxZoom: 14, pitch: 65, bearing: -25, duration: 0 });
      map.resize();
      } catch (error) { setMessage("Errore durante il disegno della traccia: " + error.message); }
    });
    const canvas = map.getCanvas();
    const onContextLost = event => { event.preventDefault(); setMessage("Il motore grafico 3D ha perso la connessione con la scheda video. Torna alla mappa 2D e riapri il 3D."); };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    map.on("error", event => {
      if (event?.error) setMessage("Alcune porzioni del rilievo potrebbero non essere disponibili. Verifica la connessione.");
    });
    return () => { canvas.removeEventListener("webglcontextlost", onContextLost); mapRef.current = null; markerRef.current?.remove(); markerRef.current = null; try { map.remove(); } catch (_) { /* cleanup */ } };
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeIndex == null || !valid[activeIndex]) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const p = valid[activeIndex];
    if (!markerRef.current) markerRef.current = new maplibregl.Marker({ color: "#f3b025" }).addTo(map);
    markerRef.current.setLngLat([Number(p.lng), Number(p.lat)]);
  }, [activeIndex, points]);

  if (valid.length < 2) return <div className="flight-map-empty">Servono almeno due punti GPS per la visualizzazione 3D.</div>;
  return <div className="terrain-3d-wrap">
    <div ref={container} className="terrain-3d-map" aria-label="Traccia del volo sulla mappa tridimensionale del terreno" />
    <div className="terrain-3d-hint">Trascina per ruotare · zoom con + e − · rotellina per scorrere la pagina</div>
    {message && <div className="terrain-3d-notice">{message}</div>}
    <small className="terrain-3d-disclaimer">Traccia arancione tratteggiata sospesa sul terreno quando sono disponibili quota GPS e dati altimetrici del suolo. Altezza indicativa, non utilizzabile per la navigazione.</small>
  </div>;
}
