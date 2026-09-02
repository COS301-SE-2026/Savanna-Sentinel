import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { BRAND_PRIMARY_COLOR } from "@/lib/mapTokens";
import type { LatLon } from "@/types/patrol";

export interface LocationPickerMapProps {
    value: LatLon | null;
    onChange: (point: LatLon) => void;
    center: [number, number];
    zoom?: number;
    className?: string;
}

export function LocationPickerMap({
    value,
    onChange,
    center,
    zoom = 10,
    className,
}: LocationPickerMapProps) {
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const markerRef = useRef<maplibregl.Marker | null>(null);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    function handleMapClick(lngLat: { lng: number; lat: number }) {
        onChangeRef.current({ lat: lngLat.lat, lon: lngLat.lng });
    }

    useEffect(() => {
        if (!map) return;
        if (!value) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }
        if (!markerRef.current) {
            const marker = new maplibregl.Marker({
                color: BRAND_PRIMARY_COLOR,
                draggable: true,
            })
                .setLngLat([value.lon, value.lat])
                .addTo(map);
            marker.on("dragend", () => {
                const lngLat = marker.getLngLat();
                onChangeRef.current({ lat: lngLat.lat, lon: lngLat.lng });
            });
            markerRef.current = marker;
        } else {
            markerRef.current.setLngLat([value.lon, value.lat]);
        }
    }, [map, value]);

    useEffect(() => {
        return () => {
            markerRef.current?.remove();
            markerRef.current = null;
        };
    }, [map]);

    return (
        <div
            className={
                className ??
                "relative h-64 w-full overflow-hidden rounded-md border border-color-border"
            }
        >
            <MapView
                center={center}
                zoom={zoom}
                onMapReady={setMap}
                onMapRemove={() => setMap(null)}
                onMapClick={handleMapClick}
                className="absolute inset-0 cursor-crosshair"
            />
            <MapControls map={map} defaultCenter={center} defaultZoom={zoom} />
        </div>
    );
}
