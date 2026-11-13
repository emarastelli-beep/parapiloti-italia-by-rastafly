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

// MapLibre-native fill extrusions: stable on browsers where custom WebGL
// layers are invisible. Heights are calculated from the same MSL GPS altitudes
// as the altitude chart, subtracting sampled terrain MSL at each vertex.
function square(lng, lat, metres) {
  const dLat = metres / 111320, dLng = metres / (111320 * Math.cos(lat * Math.PI / 180));
  return [[lng-dLng,lat-dLat],[lng+dLng,lat-dLat],[lng+dLng,lat+dLat],[lng-dLng,lat+dLat],[lng-dLng,lat-dLat]];
}
function airborneFeatures(points, map) {
  const rail = [], posts = [];
  let sampled = 0;
  const fallbackGround = Math.max(0, Number(points[0]?.altitude_m) || 0);
  const ground = p => {
    const value = map.queryTerrainElevation([Number(p.lng), Number(p.lat)], { exaggerated: false });
    if (Number.isFinite(value)) sampled++;
    return Number.isFinite(value) ? value : fallbackGround;
  };
  const samples = points.map(p => p.altitude_m == null ? null : ground(p));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i+1], altA = Number(a.altitude_m), altB = Number(b.altitude_m);
    if (a.altitude_m == null || b.altitude_m == null || !Number.isFinite(altA) || !Number.isFinite(altB)) continue;

    const aHeight = Math.max(2, altA - samples[i]);
    const bHeight = Math.max(2, altB - samples[i+1]);
    const dx = Number(b.lng) - Number(a.lng), dy = Number(b.lat) - Number(a.lat);
    const cosLat = Math.cos(Number(a.lat)*Math.PI/180);
    const len = Math.hypot(dx*cosLat,dy);
    if (len < 1e-10) continue;
    const width = 14 / 111320;
    const ox = -dy/len*width/cosLat, oy = dx*cosLat/len*width;
    // Alternate visible sections and gaps for a dashed flight route.
    for (let j=0;j<8;j+=2) {
      const p=j/8, q=(j+1)/8;
      const point=t=>[Number(a.lng)+dx*t, Number(a.lat)+dy*t];
      const p0=point(p),p1=point(q);
      const ring=[[p0[0]+ox,p0[1]+oy],[p1[0]+ox,p1[1]+oy],[p1[0]-ox,p1[1]-oy],[p0[0]-ox,p0[1]-oy]];
      const h0=aHeight+(bHeight-aHeight)*p,h1=aHeight+(bHeight-aHeight)*q;
      // Split into short sections, so each piece follows the climb/descent.
      rail.push({type:"Feature",geometry:{type:"Polygon",coordinates:[[...ring,ring[0]]]},properties:{base:Math.max(0,Math.min(h0,h1)-5),top:Math.max(h0,h1)+2}});
    }
  }
  for(let i=2;i<points.length-1;i+=3) {
    const p=points[i], alt=Number(p.altitude_m);
    if (p.altitude_m == null || !Number.isFinite(alt)) continue;
    posts.push({type:"Feature",geometry:{type:"Polygon",coordinates:[square(Number(p.lng),Number(p.lat),5)]},properties:{top:Math.max(2,alt-samples[i])}});
  }
  return {rail:{type:"FeatureCollection",features:rail},posts:{type:"FeatureCollection",features:posts},sampled};
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
      if (valid.some(p => p.altitude_m != null)) {
        const empty={type:"FeatureCollection",features:[]};
        map.addSource("flight-rail-3d",{type:"geojson",data:empty});
        map.addSource("flight-posts-3d",{type:"geojson",data:empty});
        map.addLayer({id:"flight-posts-3d",type:"fill-extrusion",source:"flight-posts-3d",
          paint:{"fill-extrusion-color":"#79c8f9","fill-extrusion-opacity":0.38,"fill-extrusion-height":["get","top"],"fill-extrusion-base":0}});
        map.addLayer({id:"flight-rail-3d",type:"fill-extrusion",source:"flight-rail-3d",
          paint:{"fill-extrusion-color":"#0064df","fill-extrusion-opacity":1,
            "fill-extrusion-height":["get","top"],"fill-extrusion-base":["get","base"]}});
        let lastSampled = -1;
        const refresh=()=>{
          if (!map.getSource("flight-rail-3d")) return;
          try {
            const result=airborneFeatures(valid,map);
            if (!result.rail.features.length || result.sampled === lastSampled) return;
            lastSampled = result.sampled;
            map.getSource("flight-rail-3d").setData(result.rail);
            map.getSource("flight-posts-3d").setData(result.posts);
            setMessage(result.sampled === 0 ? "Traccia blu 3D visibile con quota terreno provvisoria: in attesa del rilievo altimetrico." : "Traccia blu 3D aggiornata con quote del terreno disponibili.");
          } catch(error) { console.warn("3D terrain samples:",error); }
        };
        refresh();
        map.once("idle",refresh);
        map.on("moveend",refresh);
      }
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
    <small className="terrain-3d-disclaimer">Traccia blu sospesa e sostegni verticali azzurri ravvicinati, senza proiezione al suolo: quote GPS del grafico. Se il rilievo DEM non è ancora caricato, viene usata temporaneamente una quota terreno di riferimento, segnalata sopra. Simulazione non adatta alla navigazione.</small>
  </div>;
}
