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


class DashboardResponse(BaseModel):
    stats: list[StatCard]
    patrol_coverage: PatrolCoverage
    report_trends: ReportTrends
    model_performance: ModelPerformance
