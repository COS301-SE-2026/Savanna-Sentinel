import type { GeoPoint, PlannedRoute, SavedRoute } from "@/services/routeApi";
import type { LatLon } from "@/types/patrol";

export function toPlannedRoute(saved: SavedRoute): PlannedRoute {
    return {
        suggested_path: [],
        path_geometry: saved.path_geometry,
        distance_km: saved.distance_km,
        risk_coverage: saved.risk_coverage,
    };
}

export function toLatLon(point: GeoPoint): LatLon {
    return { lat: point.coordinates[1], lon: point.coordinates[0] };
}
