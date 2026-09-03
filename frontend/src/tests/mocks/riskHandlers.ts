import { http, HttpResponse } from "msw";

import type {
    ParkGridResponse,
    HeatmapResponse,
    HeatmapSnapshotListResponse,
    CellExplainResponse,
    ActiveModelResponse,
    RiskJobResponse,
    RiskTrainJobStatus,
    RiskScoreJobStatus,
} from "@/services/riskApi";

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

export const TEST_HEATMAP_ID = "heatmap-test-1";

export const TEST_HEATMAP_SNAPSHOTS: HeatmapSnapshotListResponse = {
    snapshots: [
        { heatmap_id: TEST_HEATMAP_ID, computed_at: "2026-08-20T06:00:00Z" },
    ],
};

export const TEST_HEATMAP: HeatmapResponse = {
    heatmap_id: TEST_HEATMAP_ID,
    computed_at: "2026-08-20T06:00:00Z",
    cells: TEST_GRID.features.map((feature, i) => ({
        cell_id: `${feature.properties.cell_id}-uuid`,
        cell_ref: feature.properties.cell_id,
        risk_score: [0.1, 0.4, 0.6, 0.9][i],
        geometry: feature.geometry,
    })),
};

export const TEST_CELL_EXPLAIN: CellExplainResponse = {
    cell_id: "cell-1-uuid",
    heatmap_id: TEST_HEATMAP_ID,
    top_features: [
        { feature_name: "incident_density_self", contribution: 0.6 },
        { feature_name: "patrol_recency_days", contribution: 0.4 },
    ],
    self_incidents: [
        {
            incident_type: "snare",
            occurred_at: "2026-08-18T09:00:00Z",
            severity: "high",
        },
    ],
    neighbor_incidents: [
        {
            incident_type: "poaching_sign",
            occurred_at: "2026-08-10T09:00:00Z",
            severity: "medium",
        },
        {
            incident_type: "poaching_sign",
            occurred_at: "2026-08-05T09:00:00Z",
            severity: "low",
        },
    ],
    self_sightings: [
        {
            species: "lion",
            count: 3,
            occurred_at: "2026-08-17T09:00:00Z",
        },
    ],
    neighbor_sightings: [
        {
            species: "elephant",
            count: 1,
            occurred_at: "2026-08-12T09:00:00Z",
        },
    ],
};

export const TEST_ACTIVE_MODEL: ActiveModelResponse = {
    model_id: "model-test-1",
    version: 3,
    trained_at: "2026-08-01T00:00:00Z",
    training_window_start: "2026-07-01T00:00:00Z",
    training_window_end: "2026-08-01T00:00:00Z",
    n_training_examples: 500,
    metrics: { precision: 0.7, recall: 0.6, auc: 0.8 },
};

export const TEST_TRAIN_JOB: RiskJobResponse = {
    job_id: "train-job-1",
    status: "queued",
    queued_at: "2026-08-20T06:00:00Z",
};

export const TEST_TRAIN_JOB_STATUS: RiskTrainJobStatus = {
    job_id: "train-job-1",
    status: "completed",
    model_id: "model-test-1",
    metrics: { precision: 0.7, recall: 0.6, auc: 0.8 },
    n_training_examples: 500,
};

export const TEST_SCORE_JOB: RiskJobResponse = {
    job_id: "score-job-1",
    status: "queued",
    queued_at: "2026-08-20T06:00:00Z",
};

export const TEST_SCORE_JOB_STATUS: RiskScoreJobStatus = {
    job_id: "score-job-1",
    status: "completed",
    heatmap_id: TEST_HEATMAP_ID,
    computed_at: "2026-08-20T06:00:00Z",
    n_cells_scored: 4,
};

export const riskHandlers = [
    http.get(`${BASE}/risk/grid`, () => HttpResponse.json(TEST_GRID)),
    http.get(`${BASE}/risk/heatmap/snapshots`, () =>
        HttpResponse.json(TEST_HEATMAP_SNAPSHOTS),
    ),
    http.get(`${BASE}/risk/heatmap`, () => HttpResponse.json(TEST_HEATMAP)),
    http.get(`${BASE}/risk/heatmap/cells/:cellId/explain`, () =>
        HttpResponse.json(TEST_CELL_EXPLAIN),
    ),
    http.get(`${BASE}/risk/models/active`, () =>
        HttpResponse.json(TEST_ACTIVE_MODEL),
    ),
    http.post(`${BASE}/risk/train`, () => HttpResponse.json(TEST_TRAIN_JOB)),
    http.get(`${BASE}/risk/train/:jobId`, () =>
        HttpResponse.json(TEST_TRAIN_JOB_STATUS),
    ),
    http.post(`${BASE}/risk/score`, () => HttpResponse.json(TEST_SCORE_JOB)),
    http.get(`${BASE}/risk/score/:jobId`, () =>
        HttpResponse.json(TEST_SCORE_JOB_STATUS),
    ),
];
