import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/v1";

export const RISK_RESPONSE = {
    computed_version: 7,
    computed_at: "2026-09-01T12:00:00+00:00",
    stale: false,
    cells: { "cell-1": 0.3, "cell-3": -0.15 },
};

export const ROUTE_RESPONSE = {
    computed_version: null,
    computed_at: null,
    stale: true,
    cells: { "cell-2": 50, "cell-3": 0.4 },
};

export const terrainHandlers = [
    http.get(`${BASE}/terrain/risk-adjustments`, () =>
        HttpResponse.json(RISK_RESPONSE),
    ),
    http.get(`${BASE}/terrain/route-costs`, () =>
        HttpResponse.json(ROUTE_RESPONSE),
    ),
];
