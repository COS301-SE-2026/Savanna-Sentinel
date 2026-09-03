import { api } from "./api";

export interface GridCellProperties {
    cell_id: string;
    row: number;
    col: number;
}

export interface GridCellFeature {
    type: "Feature";
    properties: GridCellProperties;
    geometry: {
        type: "Polygon";
        coordinates: number[][][];
    };
}

export interface ParkGridResponse {
    type: "FeatureCollection";
    features: GridCellFeature[];
}

export interface BoundaryCheckResponse {
    uploaded: boolean;
}
export interface DeleteBoundaryResponse {
    success: boolean;
}

export interface HeatmapCell {
    cell_id: string;
    cell_ref: string;
    risk_score: number;
    geometry: {
        type: "Polygon";
        coordinates: number[][][];
    };
}

export interface HeatmapResponse {
    heatmap_id: string;
    computed_at: string;
    cells: HeatmapCell[];
}

export interface ExplainFeature {
    feature_name: string;
    contribution: number;
}

export interface IncidentDetail {
    incident_type: string;
    occurred_at: string;
    severity: string | null;
}

export interface SightingDetail {
    species: string;
    count: number | null;
    occurred_at: string;
}

export interface CellExplainResponse {
    cell_id: string;
    heatmap_id: string;
    top_features: ExplainFeature[];
    self_incidents: IncidentDetail[];
    neighbor_incidents: IncidentDetail[];
    self_sightings: SightingDetail[];
    neighbor_sightings: SightingDetail[];
}

export interface ActiveModelResponse {
    model_id: string;
    version: number;
    trained_at: string;
    training_window_start: string;
    training_window_end: string;
    n_training_examples: number;
    metrics: Record<string, number>;
}

export interface HeatmapSnapshot {
    heatmap_id: string;
    computed_at: string;
}

export interface HeatmapSnapshotListResponse {
    snapshots: HeatmapSnapshot[];
}

export interface RiskJobResponse {
    job_id: string;
    status: string;
    queued_at: string;
}

export interface RiskTrainRequest {
    window_start?: string;
    window_end?: string;
}

export interface RiskTrainJobStatus {
    job_id: string;
    status: string;
    model_id: string | null;
    metrics: Record<string, number> | null;
    n_training_examples: number | null;
    reason?: string | null;
}

export interface RiskScoreJobStatus {
    job_id: string;
    status: string;
    heatmap_id: string | null;
    computed_at: string | null;
    n_cells_scored: number | null;
    reason?: string | null;
}

export const riskApi = {
    getParkGrid: async (): Promise<ParkGridResponse> =>
        api.get<ParkGridResponse>("/risk/grid").then((r) => r.data),

    uploadParkZone: async (file: File) => {
        const formData = new FormData();

        formData.append("file", file);
        return api.post("/risk/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
    },

    checkUploaded: async (): Promise<BoundaryCheckResponse> => {
        return api
            .get<BoundaryCheckResponse>("/risk/initialise")
            .then((r) => r.data);
    },
    deleteUpload: async (): Promise<DeleteBoundaryResponse> => {
        return api
            .delete<DeleteBoundaryResponse>("/risk/geojson")
            .then((r) => r.data);
    },

    getHeatmap: async (
        params: { date?: string; snapshot?: string } = {},
    ): Promise<HeatmapResponse> =>
        api
            .get<HeatmapResponse>("/risk/heatmap", { params })
            .then((r) => r.data),

    getHeatmapSnapshots: async (): Promise<HeatmapSnapshotListResponse> =>
        api
            .get<HeatmapSnapshotListResponse>("/risk/heatmap/snapshots")
            .then((r) => r.data),

    getCellExplain: async (cellId: string): Promise<CellExplainResponse> =>
        api
            .get<CellExplainResponse>(`/risk/heatmap/cells/${cellId}/explain`)
            .then((r) => r.data),

    getActiveModel: async (): Promise<ActiveModelResponse> =>
        api.get<ActiveModelResponse>("/risk/models/active").then((r) => r.data),

    trainModel: async (payload: RiskTrainRequest): Promise<RiskJobResponse> =>
        api.post<RiskJobResponse>("/risk/train", payload).then((r) => r.data),

    getTrainJob: async (jobId: string): Promise<RiskTrainJobStatus> =>
        api.get<RiskTrainJobStatus>(`/risk/train/${jobId}`).then((r) => r.data),

    scoreHeatmap: async (): Promise<RiskJobResponse> =>
        api.post<RiskJobResponse>("/risk/score").then((r) => r.data),

    getScoreJob: async (jobId: string): Promise<RiskScoreJobStatus> =>
        api.get<RiskScoreJobStatus>(`/risk/score/${jobId}`).then((r) => r.data),
};
