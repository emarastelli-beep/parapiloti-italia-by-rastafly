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

// Custom WebGL line layer: every vertex is positioned at its own GPS altitude
// above mean sea level, not at a height relative to the underlying terrain.
function createAirborneLayer(points) {
  const vertices = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (a.altitude_m == null || b.altitude_m == null) continue;
    const altA = Number(a.altitude_m), altB = Number(b.altitude_m);
    if (!Number.isFinite(altA) || !Number.isFinite(altB)) continue;
    // Split each leg into alternating visible and invisible pieces (dashed 3D track).
    const steps = 8;
    for (let k = 0; k < steps; k += 2) {
      const interpolate = t => {
        const lng = Number(a.lng) + (Number(b.lng) - Number(a.lng)) * t;
        const lat = Number(a.lat) + (Number(b.lat) - Number(a.lat)) * t;
        const altitude = altA + (altB - altA) * t;
        const p = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat }, altitude);
        return [p.x, p.y, p.z];
      };
      vertices.push(...interpolate(k / steps), ...interpolate((k + 1) / steps));
    }
  }
  return {
    id: "flight-airborne-absolute",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      this.gl = gl;
      const vertex = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertex, "uniform mat4 u_matrix; attribute vec3 a_position; void main() { gl_Position = u_matrix * vec4(a_position, 1.0); }");
      gl.compileShader(vertex);
      const fragment = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragment, "precision mediump float; void main() { gl_FragColor = vec4(0.953, 0.416, 0.173, 1.0); }");
      gl.compileShader(fragment);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error("Impossibile preparare la traccia 3D: " + error);
      }
      this.program = program;
      this.matrixLocation = gl.getUniformLocation(program, "u_matrix");
      this.positionLocation = gl.getAttribLocation(program, "a_position");
      this.buffer = gl.createBuffer();
      this.vertexCount = vertices.length / 3;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
    render(gl, options) {
      if (!this.vertexCount || !this.program) return;
      const matrix = options?.defaultProjectionData?.mainMatrix || options?.modelViewProjectionMatrix || options;
      if (!matrix || matrix.length !== 16) return;
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.matrixLocation, false, matrix);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(this.positionLocation);
      gl.vertexAttribPointer(this.positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.lineWidth(2);
      gl.drawArrays(gl.LINES, 0, this.vertexCount);
      gl.disableVertexAttribArray(this.positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
    onRemove(map, gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
    }
  };
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
      if (valid.some(p => p.altitude_m != null)) {
        try { map.addLayer(createAirborneLayer(valid)); }
        catch (error) { console.warn("Traccia 3D in quota non disponibile", error); }
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
    <small className="terrain-3d-disclaimer">La traccia arancione in aria usa le quote GPS assolute degli stessi punti del grafico altimetrico (metri sul livello del mare). Visualizzazione non adatta alla navigazione.</small>
  </div>;
}
