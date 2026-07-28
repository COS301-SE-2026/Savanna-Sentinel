import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const OSM_STYLE = {
    version: 8,
    sources: {
        osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
                "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
        },
    },
    layers: [
        { id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 },
    ],
};

function isResourceFetchError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const candidate = error as { url?: unknown; status?: unknown };
    return (
        typeof candidate.url === "string" &&
        typeof candidate.status === "number"
    );
}

export interface MapViewProps {
    center: [number, number];
    zoom: number;
    onMapReady: (map: maplibregl.Map) => void;
    onMapRemove: () => void;
    onMapClick?: (lngLat: { lng: number; lat: number }) => void;
    className?: string;
}

export function MapView({
    center,
    zoom,
    onMapReady,
    onMapRemove,
    onMapClick,
    className,
}: MapViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const onMapClickRef = useRef(onMapClick);
    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
        if (!containerRef.current) return;

        let map: maplibregl.Map;
        try {
            const mapOptions = {
                container: containerRef.current,
                style: OSM_STYLE as maplibregl.StyleSpecification,
                center,
                zoom,
                pitch: 0,
                maxPitch: 0,
                dragPitch: false,
                touchPitch: false,
                pitchWithRotate: false,
                attributionControl: false as const,
            };
            map = new maplibregl.Map(mapOptions);
        } catch (e) {
            const msg = String(e);
            queueMicrotask(() => setMapError(msg));
            return;
        }

        map.on("error", (e) => {
            if (isResourceFetchError(e.error)) return;
            setMapError(e.error?.message ?? "Map failed to load");
        });
        map.on("load", () => onMapReady(map));
        map.on("click", (e) => onMapClickRef.current?.(e.lngLat));

        return () => {
            setTimeout(() => map.remove(), 0);
            onMapRemove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={className ?? "absolute inset-0"}>
            <div ref={containerRef} className="h-full w-full" />
            {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-color-surface-bg/80 p-6 text-center text-sm text-color-text-primary">
                    Map failed to initialise: {mapError}
                </div>
            )}
        </div>
    );
}
