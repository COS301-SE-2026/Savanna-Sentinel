export interface LatLon {
    lat: number;
    lon: number;
}

export type ArmedField = "start" | "end" | null;

export type RouteJobStatus =
    "idle" | "queued" | "processing" | "completed" | "failed";
