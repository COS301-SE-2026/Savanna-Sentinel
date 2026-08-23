import { api } from "./api";

export interface StatCard {
    label: string;
    value: number;
    unit?: string | null;
    badge: string;
}

export interface PatrolCoverage {
    area_covered_km2: number;
    total_area_km2: number;
}

export interface ReportTypeCount {
    report_type: string;
    count: number;
}

export interface ReportTrendPoint {
    date: string;
    count: number;
}

export interface ReportTrends {
    counts_by_type: ReportTypeCount[];
    trend: ReportTrendPoint[];
}

export interface ModelMetric {
    label: string;
    value: number;
}

export interface ModelPerformance {
    metrics: ModelMetric[];
    last_trained_at?: string | null;
}

export interface RecentFieldReport {
    report_id: string;
    ranger?: string | null;
    report_type: string;
    severity?: string | null;
    zone?: string | null;
    occurred_at: string;
}

export interface RiskZone {
    zone: string;
    level: string;
    risk_score: number;
}

export interface DashboardResponse {
    stats: StatCard[];
    patrol_coverage: PatrolCoverage;
    report_trends: ReportTrends;
    model_performance: ModelPerformance;
    recent_field_reports: RecentFieldReport[];
    risk_zones: RiskZone[];
}

export const dashboardApi = {
    getDashboard: async (): Promise<DashboardResponse> =>
        api.get<DashboardResponse>("/dashboard").then((r) => r.data),
};
