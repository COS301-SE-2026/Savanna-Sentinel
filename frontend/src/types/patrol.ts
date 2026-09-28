export interface LatLon {
    lat: number;
    lon: number;
}

// keep in sync with MAX_WAYPOINTS in backend app/schemas/route.py
export const MAX_WAYPOINTS = 5;
export const MIN_STOPS = 2;
export const MAX_STOPS = MIN_STOPS + MAX_WAYPOINTS;

export interface PlannerStop {
    id: string;
    point: LatLon | null;
}

export type RouteJobStatus =
    "idle" | "queued" | "processing" | "completed" | "failed";
