import { api } from "./api";
import type {
    ReportType,
    SeverityLevel,
    LocationLatLon,
    SpeciesResponse,
    UserFilterResponse,
    ReportSortField,
} from "./reportsApi";

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
    submitted_by_username?: string | null;
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
    submitted_by_username?: string | null;
    created_at: string;
}

export interface TipoffListResponse {
    total: number;
    page: number;
    page_size: number;
    results: TipoffListItem[];
}

export interface ListTipoffsQueryParams {
    search?: string;
    sort?: ReportSortField;
    direction?: "asc" | "desc";
    report_type?: ReportType | ReportType[];
    severity?: SeverityLevel | SeverityLevel[];
    species?: string | string[];
    users?: string | string[];
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

    getSpecies: async (): Promise<SpeciesResponse> =>
        api.get<SpeciesResponse>("/tipoffs/species").then((r) => r.data),

    getUsernames: async (): Promise<UserFilterResponse> =>
        api.get<UserFilterResponse>("/tipoffs/users").then((r) => r.data),
};
