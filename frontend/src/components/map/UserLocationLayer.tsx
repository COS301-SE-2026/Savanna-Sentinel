import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import { Navigation2 } from "lucide-react";

import type { UserLocation } from "@/types/location";
import { USER_LOCATION_COLOR } from "@/lib/mapTokens";

const PUCK_SIZE_PX = 24;

export interface UserLocationLayerProps {
    map: maplibregl.Map | null;
    location: UserLocation | null;
}

export function UserLocationLayer({ map, location }: UserLocationLayerProps) {
    const [element] = useState(() => document.createElement("div"));
    const markerRef = useRef<maplibregl.Marker | null>(null);

    useEffect(() => {
        if (!map || !location) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }

        if (!markerRef.current) {
            markerRef.current = new maplibregl.Marker({
                element,
                rotationAlignment: "map",
                pitchAlignment: "map",
            })
                .setLngLat([location.lon, location.lat])
                .addTo(map);
        } else {
            markerRef.current.setLngLat([location.lon, location.lat]);
        }

        markerRef.current.setRotation(location.heading ?? 0);
    }, [map, location, element]);

    useEffect(() => {
        return () => {
            markerRef.current?.remove();
            markerRef.current = null;
        };
    }, [map]);

    if (!map || !location) return null;

    return createPortal(
        <div
            role="img"
            aria-label="Your current location"
            data-testid="user-location-puck"
            className="pointer-events-none flex items-center justify-center rounded-full border-[2.5px] border-white shadow-md"
            style={{
                width: PUCK_SIZE_PX,
                height: PUCK_SIZE_PX,
                background: USER_LOCATION_COLOR,
            }}
        >
            <Navigation2
                aria-hidden="true"
                data-testid="user-location-heading-arrow"
                className="size-3.5 fill-white text-white"
            />
        </div>,
        element,
    );
}
