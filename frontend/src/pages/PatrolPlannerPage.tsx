import { useRef, useEffect, useState } from "react";
import { RouteIcon, Clock, Navigation, AlertCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
};

const START_LNG = 31.38;
const START_LAT = -24.77;
const CELL_W    = 0.004;
const CELL_H    = 0.004;
const COLS      = 20;
const ROWS      = 13;
const CENTER: [number, number] = [
  START_LNG + (COLS * CELL_W) / 2,
  START_LAT - (ROWS * CELL_H) / 2,
];

const GRID: number[][] = [
  [0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,1,1,2,1,1,0,0,0,1,1,2,1,1,0,0,0,0,0],
  [0,1,1,2,2,2,1,1,0,0,1,2,2,2,1,0,0,0,0,0],
  [0,1,2,2,3,3,2,1,0,0,2,2,3,3,2,1,0,0,0,0],
  [1,2,2,3,4,3,2,1,0,1,2,3,4,4,3,2,1,0,0,0],
  [1,2,3,4,4,3,2,1,0,1,2,3,4,3,2,2,1,0,0,0],
  [0,1,2,3,3,3,2,1,0,0,1,2,3,3,2,1,1,0,0,0],
  [0,1,1,2,2,2,1,0,0,0,1,1,2,2,1,0,0,0,0,0],
  [0,0,1,1,2,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
  [0,0,0,1,1,1,0,0,0,0,0,1,2,2,1,0,0,0,0,0],
  [0,0,0,0,1,2,2,1,0,0,1,2,3,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,0,0,1,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,0,0,1,1,1,0,0,0,0,0,0],
];

function buildHeatmapGeoJSON() {
  const features = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = GRID[r][c];
      if (val === 0) continue;
      const w = START_LNG + c * CELL_W;
      const e = START_LNG + (c + 1) * CELL_W;
      const n = START_LAT - r * CELL_H;
      const s = START_LAT - (r + 1) * CELL_H;
      features.push({
        type: "Feature",
        properties: { risk: val },
        geometry: {
          type: "Polygon",
          coordinates: [[[w, n], [e, n], [e, s], [w, s], [w, n]]],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

const WAYPOINTS: { lng: number; lat: number; label: string }[] = [
  { lng: 31.385, lat: -24.812, label: "S" },
  { lng: 31.396, lat: -24.799, label: "1" },
  { lng: 31.408, lat: -24.787, label: "2" },
  { lng: 31.421, lat: -24.793, label: "3" },
  { lng: 31.433, lat: -24.780, label: "4" },
  { lng: 31.445, lat: -24.793, label: "E" },
];

const PRIORITY_OPTIONS = [
  "Prioritise critical-risk zones",
  "Minimise backtracking",
  "Avoid water crossings",
];

export default function PatrolPlannerPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE as maplibregl.StyleSpecification,
        center: CENTER,
        zoom: 12,
        attributionControl: false,
      });
    } catch (e) {
      setMapError(String(e));
      return;
    }

    mapRef.current = map;
    map.on("error", (e) => setMapError(e.error?.message ?? "Map failed to load"));

    map.on("load", () => {
      map.addSource("heatmap", {
        type: "geojson",
        data: buildHeatmapGeoJSON() as maplibregl.GeoJSONSourceSpecification["data"],
      });
      map.addLayer({
        id: "heatmap-fill",
        type: "fill",
        source: "heatmap",
        paint: {
          "fill-color": [
            "step", ["get", "risk"],
            "#06B050",
            2, "#FAE203",
            3, "#FF9300",
            4, "#C00000",
          ],
          "fill-opacity": 0.4,
        },
      });

      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: WAYPOINTS.map((w) => [w.lng, w.lat]),
          },
        } as maplibregl.GeoJSONSourceSpecification["data"],
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: { "line-color": "#003A6B", "line-width": 5, "line-opacity": 0.5 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#8EADC4",
          "line-width": 2.5,
          "line-dasharray": [3, 2],
        },
      });

      WAYPOINTS.forEach(({ lng, lat, label }, i) => {
        const isStart = label === "S";
        const isEnd   = label === "E";
        const bg      = isStart ? "#0070BF" : isEnd ? "#C00000" : "#ffffff";
        const color   = isStart || isEnd ? "#ffffff" : "#003A6B";

        const el = document.createElement("div");
        el.style.cssText = [
          "width:26px", "height:26px", "border-radius:50%",
          `background:${bg}`, "border:2.5px solid white",
          "display:flex", "align-items:center", "justify-content:center",
          `font-size:${isStart || isEnd ? 10 : 11}px`,
          "font-weight:700", `color:${color}`,
          "font-family:sans-serif",
          "box-shadow:0 2px 6px rgba(0,0,0,0.4)",
          "cursor:default",
        ].join(";");
        el.textContent = label;

        new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setText(
              i === 0
                ? "Start: Gate A"
                : i === WAYPOINTS.length - 1
                ? "End: Gate A return"
                : `Waypoint ${label}`
            )
          )
          .addTo(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 rounded-md bg-brand-dark-blue text-white px-4 py-2.5 text-sm flex items-center gap-2">
        <RouteIcon className="size-4 shrink-0" />
        <span>
          This page is still to come, but here's a little teaser.
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-foreground mb-6">
        Patrol Planner
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">Route Parameters</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Start Location
              </label>
              <select
                disabled
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted opacity-70 cursor-not-allowed"
              >
                <option>Gate A: Western entrance</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Patrol Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  disabled
                  value="4"
                  className="w-16 border border-border rounded-md px-3 py-2 text-sm bg-muted opacity-70 cursor-not-allowed text-center"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Priority
              </label>
              <div className="space-y-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 cursor-not-allowed opacity-75 text-sm"
                  >
                    <div className="size-4 rounded border-2 border-brand-dark-blue bg-brand-dark-blue flex items-center justify-center shrink-0">
                      <div className="size-1.5 bg-white rounded-sm" />
                    </div>
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <Button disabled className="w-full opacity-60 gap-1.5">
              <Play className="size-4" />
              Generate Route
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Suggested Route</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <RouteIcon className="size-4" />Distance
                </span>
                <span className="font-medium">18.4 km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4" />Est. time
                </span>
                <span className="font-medium">3h 50m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Navigation className="size-4" />Waypoints
                </span>
                <span className="font-medium">6 stops</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="size-4 text-spot-orange" />Risk coverage
                </span>
                <span className="font-medium">74%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-lg border border-border overflow-hidden relative" style={{ height: 420 }}>
          <div ref={containerRef} className="w-full h-full" />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-sm text-muted-foreground p-6 text-center">
              Map failed to initialise: {mapError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}