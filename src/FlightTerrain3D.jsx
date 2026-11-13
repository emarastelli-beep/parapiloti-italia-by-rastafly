import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TERRAIN_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function boundsFor(points) {
  const lngs = points.map(p => Number(p.lng));
  const lats = points.map(p => Number(p.lat));
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export default function FlightTerrain3D({ points }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [message, setMessage] = useState("");
  const valid = (points || []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180);

  useEffect(() => {
    if (!container.current || valid.length < 2) return;
    if (!maplibregl.supported()) {
      setMessage("La visualizzazione 3D richiede WebGL, non disponibile su questo dispositivo.");
      return;
    }
    const coords = valid.map(p => [Number(p.lng), Number(p.lat)]);
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: { type: "raster", tiles: [OSM_URL], tileSize: 256, attribution: "© OpenStreetMap contributors" },
          terrain: { type: "raster-dem", tiles: [TERRAIN_URL], tileSize: 256, maxzoom: 15, encoding: "terrarium", attribution: "Terrain DEM: AWS Terrain Tiles" }
        },
        layers: [{ id: "base-map", type: "raster", source: "osm" }],
        terrain: { source: "terrain", exaggeration: 1.35 }
      },
      center: coords[0],
      zoom: 11,
      pitch: 65,
      bearing: -25,
      antialias: true,
      attributionControl: true
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      map.addSource("flight-path", { type: "geojson", data: {
        type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {}
      }});
      map.addLayer({ id: "flight-path-line", type: "line", source: "flight-path", paint: {
        "line-color": "#ff623a", "line-width": 5, "line-opacity": 0.95
      }, layout: { "line-cap": "round", "line-join": "round" }});
      new maplibregl.Marker({ color: "#13a879" }).setLngLat(coords[0]).addTo(map);
      new maplibregl.Marker({ color: "#d9473e" }).setLngLat(coords[coords.length - 1]).addTo(map);
      map.fitBounds(boundsFor(valid), { padding: 75, maxZoom: 14, pitch: 65, bearing: -25, duration: 0 });
      map.resize();
    });
    map.on("error", event => {
      if (event?.error) setMessage("Alcune porzioni del rilievo potrebbero non essere disponibili. Verifica la connessione.");
    });
    return () => { mapRef.current = null; map.remove(); };
  }, [points]);

  if (valid.length < 2) return <div className="flight-map-empty">Servono almeno due punti GPS per la visualizzazione 3D.</div>;
  return <div className="terrain-3d-wrap">
    <div ref={container} className="terrain-3d-map" aria-label="Traccia del volo sulla mappa tridimensionale del terreno" />
    <div className="terrain-3d-hint">Trascina per ruotare · usa i controlli per inclinare e zoomare</div>
    {message && <div className="terrain-3d-notice">{message}</div>}
    <small className="terrain-3d-disclaimer">Traccia proiettata sul terreno 3D. Le quote reali del volo richiedono dati altimetrici GPS salvati per ciascun punto. Visualizzazione non adatta alla navigazione.</small>
  </div>;
}
