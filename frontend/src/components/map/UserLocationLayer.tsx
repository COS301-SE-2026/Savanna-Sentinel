import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import { Navigation2 } from "lucide-react";

import type { UserLocation } from "@/types/location";
import { USER_LOCATION_COLOR } from "@/lib/mapTokens";

const PUCK_SIZE_PX = 24;
const ACCURACY_SOURCE_ID = "user-location-accuracy-source";
const ACCURACY_FILL_LAYER_ID = "user-location-accuracy-fill";
const ACCURACY_LINE_LAYER_ID = "user-location-accuracy-line";

export interface UserLocationLayerProps {
    map: maplibregl.Map | null;
    location: UserLocation | null;
}

function createCircle(
    center: [number, number],
    radius: number,
    edges = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
    const [lng, lat] = center;
    const coords: [number, number][] = [];

    const km = radius / 1000;
    const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < edges; i++) {
        const theta = (i / edges) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        coords.push([lng + x, lat + y]);
    }
    coords.push(coords[0]);

    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [coords],
        },
    };
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
        if (!map || !location || location.accuracy <= 0) {
            return;
        }

        const circle = createCircle(
            [location.lon, location.lat],
            location.accuracy,
        );

        const source = map.getSource(
            ACCURACY_SOURCE_ID,
        ) as maplibregl.GeoJSONSource;

        if (source) {
            source.setData(circle);
        } else {
            map.addSource(ACCURACY_SOURCE_ID, {
                type: "geojson",
                data: circle,
            });

            map.addLayer({
                id: ACCURACY_FILL_LAYER_ID,
                type: "fill",
                source: ACCURACY_SOURCE_ID,
                paint: {
                    "fill-color": USER_LOCATION_COLOR,
                    "fill-opacity": 0.15,
                },
            });

            map.addLayer({
                id: ACCURACY_LINE_LAYER_ID,
                type: "line",
                source: ACCURACY_SOURCE_ID,
                paint: {
                    "line-color": USER_LOCATION_COLOR,
                    "line-width": 1.5,
                    "line-opacity": 0.5,
                },
            });
        }
    }, [map, location]);

    useEffect(() => {
        return () => {
            markerRef.current?.remove();
            markerRef.current = null;

            if (map && map.getStyle()) {
                if (map.getLayer(ACCURACY_LINE_LAYER_ID)) {
                    map.removeLayer(ACCURACY_LINE_LAYER_ID);
                }
                if (map.getLayer(ACCURACY_FILL_LAYER_ID)) {
                    map.removeLayer(ACCURACY_FILL_LAYER_ID);
                }
                if (map.getLayer(ACCURACY_SOURCE_ID)) {
                    map.removeLayer(ACCURACY_SOURCE_ID);
                }
            }
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
