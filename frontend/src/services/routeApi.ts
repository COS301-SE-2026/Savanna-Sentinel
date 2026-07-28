import { api } from "./api";

export interface GeoPoint {
    type: "Point";
    coordinates: [number, number];
}

export interface GeoLineString {
    type: "LineString";
    coordinates: [number, number][];
}

export interface PlannedRoute {
    suggested_path: string[];
    path_geometry: GeoLineString;
    estimated_time_min: number;
    estimated_fuel_l: number;
    risk_coverage: number;
}

export interface RouteRequest {
    park_id: string;
    start_point: GeoPoint;
    end_point: GeoPoint;
    max_time?: number;
    max_fuel?: number;
    num_alternatives?: number;
    risk_by_cell?: Record<string, number>;
}

export interface RouteJobResponse {
    job_id: string;
    request_id: string;
    park_id: string;
    status: string;
    queued_at: string;
}

export interface RouteListResponse {
    request_id: string | null;
    status: string | null;
    num_alternatives_requested: number | null;
    num_alternatives_found: number | null;
    total: number;
    page: number;
    page_size: number;
    results: PlannedRoute[];
}

export const routeApi = {
    generateRoute: async (payload: RouteRequest): Promise<RouteJobResponse> =>
        api.post<RouteJobResponse>("/routes", payload).then((r) => r.data),

    getRouteJob: async (requestId: string): Promise<RouteListResponse> =>
        api
            .get<RouteListResponse>("/routes", {
                params: { request_id: requestId },
            })
            .then((r) => r.data),
};
