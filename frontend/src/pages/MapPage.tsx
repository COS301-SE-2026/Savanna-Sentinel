import { useRef, useEffect, useState } from "react";
import { Map as MapIcon, ZoomIn, ZoomOut, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

function buildGeoJSON() {
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

const LAYERS = [
  { id: "heatmap", label: "Risk Heatmap",  on: true  },
  { id: null,      label: "Patrol Routes", on: false },
  { id: null,      label: "Incidents",     on: true  },
  { id: null,      label: "Water Sources", on: false },
  { id: null,      label: "Fence Lines",   on: false },
];

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const [layerOn, setLayerOn] = useState(true);
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
      const msg = String(e);
      queueMicrotask(() => setMapError(msg));
      return;
    }

    mapRef.current = map;
    map.on("error", (e) => setMapError(e.error?.message ?? "Map failed to load"));

    map.on("load", () => {
      map.addSource("heatmap", {
        type: "geojson",
        data: buildGeoJSON() as maplibregl.GeoJSONSourceSpecification["data"],
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
          "fill-opacity": 0.55,
        },
      });

      map.addLayer({
        id: "heatmap-outline",
        type: "line",
        source: "heatmap",
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.5,
          "line-opacity": 0.25,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function toggleHeatmap() {
    const map = mapRef.current;
    if (!map) return;
    const next = !layerOn;
    setLayerOn(next);
    const vis = next ? "visible" : "none";
    if (map.getLayer("heatmap-fill"))   map.setLayoutProperty("heatmap-fill",    "visibility", vis);
    if (map.getLayer("heatmap-outline")) map.setLayoutProperty("heatmap-outline", "visibility", vis);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="bg-brand-dark-blue text-white px-4 py-2.5 text-sm flex items-center gap-2 shrink-0">
        <MapIcon className="size-4 shrink-0" />
        <span>
          This page is still to come, but here's a little teaser.
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 bg-card border-r p-4 flex flex-col gap-5 overflow-y-auto shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Time Range
            </p>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Jan 2025</span><span>May 2026</span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full">
              <div className="absolute inset-y-0 left-0 w-4/5 bg-brand-steel-blue rounded-full" />
              <div className="absolute top-1/2 left-[80%] -translate-x-1/2 -translate-y-1/2 size-3 rounded-full bg-white border-2 border-brand-dark-blue shadow-sm" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Snapshot: 14 May 2026
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Layers
            </p>
            <div className="space-y-1.5">
              {LAYERS.map(({ id, label, on }) => {
                const isHeatmap = id === "heatmap";
                const active = isHeatmap ? layerOn : on;
                return (
                  <label
                    key={label}
                    className={`flex items-center gap-2 ${isHeatmap ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                    onClick={isHeatmap ? toggleHeatmap : undefined}
                  >
                    <div
                      className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? "bg-brand-dark-blue border-brand-dark-blue"
                          : "border-border bg-background"
                      }`}
                    >
                      {active && <div className="size-1.5 bg-white rounded-sm" />}
                    </div>
                    <span className="text-sm select-none">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Summary
            </p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Critical cells</dt>
                <dd className="font-medium text-spot-red">6</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">High-risk cells</dt>
                <dd className="font-medium text-spot-orange">23</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Incidents (30d)</dt>
                <dd className="font-medium">142</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="font-medium">14 May</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="flex-1 relative overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-sm text-muted-foreground p-6 text-center">
              Map failed to initialise: {mapError}
            </div>
          )}

          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <Button
              size="icon-sm"
              variant="secondary"
              className="shadow"
              onClick={() => mapRef.current?.zoomIn()}
            >
              <ZoomIn />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              className="shadow"
              onClick={() => mapRef.current?.zoomOut()}
            >
              <ZoomOut />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              className="shadow mt-1"
              onClick={() => mapRef.current?.resetNorthPitch({ duration: 400 })}
            >
              <Compass />
            </Button>
          </div>
        </div>

        <div className="w-36 bg-card border-l p-4 flex flex-col gap-3 shrink-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Risk Level
          </p>
          {(
            [
              ["#C00000", "Critical"],
              ["#FF9300", "High"],
              ["#FAE203", "Medium"],
              ["#06B050", "Low"],
            ] as const
          ).map(([color, label]) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="size-4 rounded-sm shrink-0 border border-border/50"
                style={{ background: color, opacity: 0.75 }}
              />
              <span className="text-sm">{label}</span>
            </div>
          ))}

          <hr className="border-border my-1" />
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Model
          </p>
          <div className="text-xs space-y-1 text-muted-foreground">
            <p>Random Forest v2.1</p>
            <p>
              F1 score:{" "}
              <span className="text-foreground font-medium">0.87</span>
            </p>
            <p>
              Cells:{" "}
              <span className="text-foreground font-medium">260</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}