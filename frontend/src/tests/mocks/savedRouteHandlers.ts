import { http, HttpResponse } from "msw";

import type { SavedRoute, SavedRouteListResponse } from "@/services/routeApi";

const BASE = "http://localhost:8000/v1";

export const SAVED_ROUTE_ID = "saved-route-1";

export const SAVED_ROUTE: SavedRoute = {
    id: SAVED_ROUTE_ID,
    request_id: "job-123",
    start_point: { type: "Point", coordinates: [31.05, -24.3] },
    end_point: { type: "Point", coordinates: [31.08, -24.32] },
    max_time: 120,
    max_fuel: 15,
    risk_by_cell: { "cell-1": 0.5, "cell-2": 0.9 },
    path_geometry: {
        type: "LineString",
        coordinates: [
            [31.05, -24.3],
            [31.06, -24.31],
        ],
    },
    estimated_time_min: 55,
    estimated_fuel_l: 22,
    risk_coverage: 0.42,
    created_at: "2026-01-15T09:30:00Z",
};

export const SAVED_ROUTES_LIST: SavedRouteListResponse = {
    total: 1,
    page: 1,
    page_size: 20,
    results: [SAVED_ROUTE],
};

export const savedRouteHandlers = [
    http.post(`${BASE}/routes/save`, () =>
        HttpResponse.json(SAVED_ROUTE, { status: 201 }),
    ),

    http.get(`${BASE}/routes/saved`, () => HttpResponse.json(SAVED_ROUTES_LIST)),
];
