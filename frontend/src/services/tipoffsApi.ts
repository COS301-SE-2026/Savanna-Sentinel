import { api } from "./api";
import type { ReportType, SeverityLevel, LocationLatLon } from "./reportsApi";

export interface TipoffCreate {
    report_type: ReportType;
    location: LocationLatLon;
    occurred_at: string;
    description: string;
    incident_type?: string;
    severity?: SeverityLevel;
    species?: string;
    count?: number;
    images?: string[];
}

export interface TipoffSubmitResponse {
    tipoff_id: string;
    report_type: string;
    status: string;
    submitted_by: string;
    created_at: string;
}

export interface TipoffListItem {
    tipoff_id: string;
    report_type: string;
    location: LocationLatLon;
    occurred_at: string;
    description: string;
    incident_type?: string | null;
    severity?: string | null;
    species?: string | null;
    count?: number | null;
    images: string[];
    submitted_by: string;
    created_at: string;
}

export interface TipoffListResponse {
    total: number;
    page: number;
    page_size: number;
    results: TipoffListItem[];
}

export interface ListTipoffsQueryParams {
    report_type?: ReportType;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
}

export const tipoffsApi = {
    submitTipoff: async (
        payload: TipoffCreate,
    ): Promise<TipoffSubmitResponse> =>
        api.post<TipoffSubmitResponse>("/tipoffs", payload).then((r) => r.data),

    listTipoffs: async (
        payload?: ListTipoffsQueryParams,
    ): Promise<TipoffListResponse> =>
        api
            .get<TipoffListResponse>("/tipoffs", { params: payload })
            .then((r) => r.data),
};
