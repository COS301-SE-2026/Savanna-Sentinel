from datetime import datetime, timedelta, timezone

from app.repositories import dashboard_repository, risk_repository
from app.schemas.dashboard import (
    DashboardResponse,
    ModelMetric,
    ModelPerformance,
    PatrolCoverage,
    RecentFieldReport,
    ReportTrends,
    RiskZone,
    StatCard,
)

_PARK_ID = "klaserie"
_TREND_WINDOW_DAYS = 7


async def get_dashboard(session) -> DashboardResponse:
    since = datetime.now(timezone.utc) - timedelta(days=_TREND_WINDOW_DAYS)

    stats = await dashboard_repository.get_operational_stats(
        session, _PARK_ID, since,
    )
    covered_km2, total_km2 = await dashboard_repository.get_patrol_coverage(
        session, _PARK_ID, since,
    )
    counts_by_type, trend = await dashboard_repository.get_report_trends(
        session, since,
    )
    active_model = await risk_repository.get_active_model_details(
        session, _PARK_ID,
    )
    recent_field_reports = await dashboard_repository.get_recent_field_reports(
        session, _PARK_ID,
    )
    risk_zones = await risk_repository.get_risk_zone_overview(session, _PARK_ID)

    return DashboardResponse(
        stats=[
            StatCard(
                label="Field Reports This Week",
                value=stats["reports_this_week"],
                badge="Shield",
            ),
            StatCard(
                label="Tip-offs This Week",
                value=stats["tipoffs_this_week"],
                badge="Activity",
            ),
            StatCard(label="Active Rangers",
            value=stats["active_rangers"],
            badge="Users",
            ),
        ],
        patrol_coverage=PatrolCoverage(
            area_covered_km2=round(covered_km2, 1),
            total_area_km2=round(total_km2, 1),
        ),
        report_trends=ReportTrends(
            counts_by_type=counts_by_type,
            trend=trend,
        ),
        model_performance=ModelPerformance(
            metrics=(
                [
                    ModelMetric(label=k.replace("_", " ").title(), value=v)
                    for k, v in active_model["metrics"].items()
                ]
                if active_model
                else []
            ),
            last_trained_at=active_model["trained_at"]
            if active_model
            else None,
        ),
        recent_field_reports=[
            RecentFieldReport(**r) for r in recent_field_reports
        ],
        risk_zones=[RiskZone(**z) for z in risk_zones],
    )
