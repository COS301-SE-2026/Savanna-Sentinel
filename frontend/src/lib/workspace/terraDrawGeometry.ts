import type * as maplibregl from "maplibre-gl";
import simplify from "@turf/simplify";

import type { FeatureGeometryType } from "./types";

export function geoJsonTypeToFeatureType(
    geoJsonType: string,
): FeatureGeometryType | null {
    if (geoJsonType === "Point") return "point";
    if (geoJsonType === "LineString") return "line";
    if (geoJsonType === "Polygon") return "polygon";
    return null;
}

export function workspaceTypeToTerraDrawMode(
    type: FeatureGeometryType,
): string {
    if (type === "point") return "point";
    if (type === "line") return "linestring";
    return "polygon";
}

export function pixelToleranceToDegrees(
    map: maplibregl.Map,
    pixels: number,
): number {
    const center = map.getCenter();
    const centerPoint = map.project(center);
    const offset = map.unproject([centerPoint.x + pixels, centerPoint.y]);
    return Math.hypot(offset.lng - center.lng, offset.lat - center.lat);
}

export function simplifyFreehandGeometry<
    T extends GeoJSON.LineString | GeoJSON.Polygon,
>(geometry: T, map: maplibregl.Map, pixelTolerance = 3): T {
    return simplify(geometry, {
        tolerance: pixelToleranceToDegrees(map, pixelTolerance),
    });
}
