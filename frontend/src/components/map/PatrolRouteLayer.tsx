import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

import type { LatLon } from "@/types/patrol";
import type { PlannedRoute } from "@/services/routeApi";
import {
    SELECTED_ROUTE_COLOR,
    UNSELECTED_ROUTE_COLOR,
    BRAND_PRIMARY_COLOR,
} from "@/lib/mapTokens";

const MAX_ROUTE_SLOTS = 3;

export interface PatrolRouteLayerProps {
    map: maplibregl.Map | null;
    startPoint: LatLon | null;
    endPoint: LatLon | null;
    routes: PlannedRoute[];
    selectedIndex: number;
}

function createStartMarkerElement(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = [
        "width:24px",
        "height:24px",
        "border-radius:50%",
        `background:${BRAND_PRIMARY_COLOR}`,
        "border:2px solid white",
        "box-shadow:0 0 0 1.5px rgba(0,0,0,0.25)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
    ].join(";");
    el.innerHTML =
        '<svg width="8" height="8" viewBox="0 0 8 8" fill="white"><polygon points="2,1 7,4 2,7" /></svg>';
    return el;
}

function createEndMarkerElement(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = [
        "width:18px",
        "height:18px",
        `background:${BRAND_PRIMARY_COLOR}`,
        "border:2px solid white",
        "box-shadow:0 0 0 1.5px rgba(0,0,0,0.25)",
        "transform:rotate(45deg)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
    ].join(";");
    const inner = document.createElement("div");
    inner.style.cssText =
        "width:6px;height:6px;background:white;transform:rotate(-45deg)";
    el.appendChild(inner);
    return el;
}

export function PatrolRouteLayer({
    map,
    startPoint,
    endPoint,
    routes,
    selectedIndex,
}: PatrolRouteLayerProps) {
    const startMarkerRef = useRef<maplibregl.Marker | null>(null);
    const endMarkerRef = useRef<maplibregl.Marker | null>(null);

    useEffect(() => {
        if (!map) return;
        if (!startPoint) {
            startMarkerRef.current?.remove();
            startMarkerRef.current = null;
            return;
        }
        if (!startMarkerRef.current) {
            startMarkerRef.current = new maplibregl.Marker({
                element: createStartMarkerElement(),
            })
                .setLngLat([startPoint.lon, startPoint.lat])
                .addTo(map);
        } else {
            startMarkerRef.current.setLngLat([startPoint.lon, startPoint.lat]);
        }
    }, [map, startPoint]);

    useEffect(() => {
        if (!map) return;
        if (!endPoint) {
            endMarkerRef.current?.remove();
            endMarkerRef.current = null;
            return;
        }
        if (!endMarkerRef.current) {
            endMarkerRef.current = new maplibregl.Marker({
                element: createEndMarkerElement(),
            })
                .setLngLat([endPoint.lon, endPoint.lat])
                .addTo(map);
        } else {
            endMarkerRef.current.setLngLat([endPoint.lon, endPoint.lat]);
        }
    }, [map, endPoint]);

    useEffect(() => {
        return () => {
            startMarkerRef.current?.remove();
            startMarkerRef.current = null;
            endMarkerRef.current?.remove();
            endMarkerRef.current = null;
        };
    }, [map]);

    useEffect(() => {
        if (!map) return;

        routes.forEach((route, index) => {
            const sourceId = `patrol-route-${index}`;
            const layerId = `${sourceId}-line`;
            const isSelected = index === selectedIndex;

            const data: GeoJSON.Feature = {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "LineString",
                    coordinates: route.path_geometry.coordinates,
                },
            };

            if (map.getSource(sourceId)) {
                (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(
                    data,
                );
            } else {
                map.addSource(sourceId, { type: "geojson", data });
            }

            if (!map.getLayer(layerId)) {
                map.addLayer({
                    id: layerId,
                    type: "line",
                    source: sourceId,
                    layout: { "line-cap": "round", "line-join": "round" },
                    paint: {
                        "line-color": isSelected
                            ? SELECTED_ROUTE_COLOR
                            : UNSELECTED_ROUTE_COLOR,
                        "line-width": isSelected ? 5 : 2,
                        "line-opacity": isSelected ? 1 : 0.4,
                    },
                });
            } else {
                map.setPaintProperty(
                    layerId,
                    "line-color",
                    isSelected ? SELECTED_ROUTE_COLOR : UNSELECTED_ROUTE_COLOR,
                );
                map.setPaintProperty(layerId, "line-width", isSelected ? 5 : 2);
                map.setPaintProperty(
                    layerId,
                    "line-opacity",
                    isSelected ? 1 : 0.4,
                );
            }
        });

        for (let i = routes.length; i < MAX_ROUTE_SLOTS; i++) {
            const sourceId = `patrol-route-${i}`;
            const layerId = `${sourceId}-line`;
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
    }, [map, routes, selectedIndex]);

    useEffect(() => {
        return () => {
            if (!map) return;
            for (let i = 0; i < MAX_ROUTE_SLOTS; i++) {
                const sourceId = `patrol-route-${i}`;
                const layerId = `${sourceId}-line`;
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            }
        };
    }, [map]);

    return null;
}
