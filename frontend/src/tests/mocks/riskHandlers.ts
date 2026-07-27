import { http, HttpResponse } from "msw";

import type { ParkGridResponse } from "@/services/riskApi";

const BASE = "http://localhost:8000/v1";

export const TEST_GRID: ParkGridResponse = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { cell_id: "cell-1", row: 0, col: 0 },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [31.0, -24.3],
                        [31.01, -24.3],
                        [31.01, -24.31],
                        [31.0, -24.31],
                        [31.0, -24.3],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { cell_id: "cell-2", row: 0, col: 1 },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [31.01, -24.3],
                        [31.02, -24.3],
                        [31.02, -24.31],
                        [31.01, -24.31],
                        [31.01, -24.3],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { cell_id: "cell-3", row: 1, col: 0 },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [31.0, -24.31],
                        [31.01, -24.31],
                        [31.01, -24.32],
                        [31.0, -24.32],
                        [31.0, -24.31],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { cell_id: "cell-4", row: 1, col: 1 },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [31.01, -24.31],
                        [31.02, -24.31],
                        [31.02, -24.32],
                        [31.01, -24.32],
                        [31.01, -24.31],
                    ],
                ],
            },
        },
    ],
};

export const riskHandlers = [
    http.get(`${BASE}/risk/grid`, () => HttpResponse.json(TEST_GRID)),
];
