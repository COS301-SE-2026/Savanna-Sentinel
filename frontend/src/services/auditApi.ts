import { api } from "./api";

export interface AuditLogRequest {
    actor_id?: string;
    action?: string;
    target_type?: string;
    target_id?: string;
    page?: number;
    page_size: number;
}
export interface AuditLogListItem {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: Record<string, string> | null;
    created_at: string;
}

export interface AuditLogResponse {
    total: number;
    page: number;
    page_size: number;
    results: AuditLogListItem[];
}

export const auditApi = {
    getLogs: async (payload: AuditLogRequest): Promise<AuditLogResponse> =>
        api
            .get<AuditLogResponse>("/audit-logs", { params: payload })
            .then((r) => r.data),
};
