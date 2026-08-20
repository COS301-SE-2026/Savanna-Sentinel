export interface StatCardData {
    label: string;
    value: number;
    unit?: string;
}

export interface PatrolCoverageData {
    areaCoveredKm2: number;
    totalAreaKm2: number;
}

export interface ReportTypeCount {
    reportType: "incident" | "sighting";
    count: number;
}

export interface ReportTrendPoint {
    date: string;
    count: number;
}

export interface ReportTrendsData {
    countsByType: ReportTypeCount[];
    trend: ReportTrendPoint[];
}

export interface ModelMetric {
    label: string;
    value: number;
}

export interface ModelPerformanceData {
    metrics: ModelMetric[];
    lastTrainedAt: string | null;
}

export interface DashboardData {
    stats: StatCardData[];
    patrolCoverage: PatrolCoverageData;
    reportTrends: ReportTrendsData;
    modelPerformance: ModelPerformanceData;
}
