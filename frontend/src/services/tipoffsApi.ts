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

export const tipoffsApi = {
    submitTipoff: async (
        payload: TipoffCreate,
    ): Promise<TipoffSubmitResponse> =>
        api.post<TipoffSubmitResponse>("/tipoffs", payload).then((r) => r.data),
};
