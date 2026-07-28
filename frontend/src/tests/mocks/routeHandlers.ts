import { http, HttpResponse } from "msw";

import type { RouteListResponse } from "@/services/routeApi";

const BASE = "http://localhost:8000/v1";

export const ROUTE_REQUEST_ID = "job-123";

export const COMPLETED_ROUTES: RouteListResponse = {
    request_id: ROUTE_REQUEST_ID,
    status: "completed",
    num_alternatives_requested: 3,
    num_alternatives_found: 2,
    total: 2,
    page: 1,
    page_size: 20,
    results: [
        {
            suggested_path: ["cell-1", "cell-2"],
            path_geometry: {
                type: "LineString",
                coordinates: [
                    [31.0, -24.3],
                    [31.01, -24.31],
                ],
            },
            estimated_time_min: 38,
            estimated_fuel_l: 16,
            risk_coverage: 0.74,
        },
        {
            suggested_path: ["cell-1", "cell-3"],
            path_geometry: {
                type: "LineString",
                coordinates: [
                    [31.0, -24.3],
                    [31.02, -24.32],
                ],
            },
            estimated_time_min: 45,
            estimated_fuel_l: 21,
            risk_coverage: 0.58,
        },
    ],
};

export const routeHandlers = [
    http.post(`${BASE}/routes`, async () =>
        HttpResponse.json(
            {
                job_id: ROUTE_REQUEST_ID,
                request_id: ROUTE_REQUEST_ID,
                park_id: "klaserie",
                status: "queued",
                queued_at: new Date().toISOString(),
            },
            { status: 202 },
        ),
    ),

    http.get(`${BASE}/routes`, ({ request }) => {
        const url = new URL(request.url);
        const requestId = url.searchParams.get("request_id");
        if (requestId !== ROUTE_REQUEST_ID) {
            return HttpResponse.json({
                request_id: null,
                status: null,
                num_alternatives_requested: null,
                num_alternatives_found: null,
                total: 0,
                page: 1,
                page_size: 20,
                results: [],
            });
        }
        return HttpResponse.json(COMPLETED_ROUTES);
    }),
];
