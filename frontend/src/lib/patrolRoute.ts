import type { GeoPoint, PlannedRoute, SavedRoute } from "@/services/routeApi";
import type { LatLon } from "@/types/patrol";

export function toPlannedRoute(saved: SavedRoute): PlannedRoute {
    return {
        suggested_path: [],
        path_geometry: saved.path_geometry,
        estimated_time_min: saved.estimated_time_min,
        estimated_fuel_l: saved.estimated_fuel_l,
        risk_coverage: saved.risk_coverage,
    };
}

export function toLatLon(point: GeoPoint): LatLon {
    return { lat: point.coordinates[1], lon: point.coordinates[0] };
}
