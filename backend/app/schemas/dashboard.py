from pydantic import BaseModel


class StatCard(BaseModel):
    label: str
    value: float
    unit: str | None = None


class PatrolCoverage(BaseModel):
    area_covered_km2: float
    total_area_km2: float


class ReportTypeCount(BaseModel):
    report_type: str
    count: int


class ReportTrendPoint(BaseModel):
    date: str
    count: int


class ReportTrends(BaseModel):
    counts_by_type: list[ReportTypeCount]
    trend: list[ReportTrendPoint]


class ModelMetric(BaseModel):
    label: str
    value: float


class ModelPerformance(BaseModel):
    metrics: list[ModelMetric]
    last_trained_at: str | None = None


class RecentFieldReport(BaseModel):
    report_id: str
    ranger: str | None = None
    report_type: str
    severity: str | None = None
    zone: str | None = None
    occurred_at: str


class RiskZone(BaseModel):
    zone: str
    level: str
    risk_score: float


class DashboardResponse(BaseModel):
    stats: list[StatCard]
    patrol_coverage: PatrolCoverage
    report_trends: ReportTrends
    model_performance: ModelPerformance
    recent_field_reports: list[RecentFieldReport]
    risk_zones: list[RiskZone]
