from unittest.mock import AsyncMock

import pytest

from app.services.dashboard_service import get_dashboard


@pytest.mark.asyncio
async def test_get_dashboard_composes_all_sections(monkeypatch):
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_operational_stats",
        AsyncMock(
            return_value={
                "reports_this_week": 5,
                "tipoffs_this_week": 2,
                "active_rangers": 3,
                "patrols_this_week": 4,
            },
        ),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_patrol_coverage",
        AsyncMock(return_value=(120.0, 500.0)),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_report_trends",
        AsyncMock(
            return_value=(
                [{"report_type": "incident", "count": 5}],
                [{"date": "2026-08-19", "count": 5}],
            ),
        ),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.risk_repository.get_active_model_details",
        AsyncMock(
            return_value={
                "trained_at": "2026-08-10T09:00:00",
                "metrics": {"f1_score": 0.84},
            },
        ),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_recent_field_reports",
        AsyncMock(
            return_value=[
                {
                    "report_id": "rpt-1",
                    "ranger": "ranger1",
                    "report_type": "incident",
                    "severity": "high",
                    "zone": "Zone 1-3",
                    "occurred_at": "2026-08-19T10:00:00",
                },
            ],
        ),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.risk_repository.get_risk_zone_overview",
        AsyncMock(
            return_value=[
                {"zone": "Zone 1-3", "level": "Critical", "risk_score": 0.9},
            ],
        ),
    )

    result = await get_dashboard(session=object())

    assert result.stats[0].value == 5
    assert result.patrol_coverage.area_covered_km2 == 120.0
    assert result.model_performance.metrics[0].label == "F1 Score"
    assert result.model_performance.metrics[0].value == 0.84
    assert result.recent_field_reports[0].report_id == "rpt-1"
    assert result.risk_zones[0].level == "Critical"


@pytest.mark.asyncio
async def test_get_dashboard_handles_no_active_model(monkeypatch):
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_operational_stats",
        AsyncMock(
            return_value={
                "reports_this_week": 5,
                "tipoffs_this_week": 2,
                "active_rangers": 3,
                "patrols_this_week": 4,
            },
        ),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_patrol_coverage",
        AsyncMock(return_value=(120.0, 500.0)),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_report_trends",
        AsyncMock(
            return_value=(
                [{"report_type": "incident", "count": 5}],
                [{"date": "2026-08-19", "count": 5}],
            ),
        ),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.risk_repository.get_active_model_details",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.dashboard_repository.get_recent_field_reports",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        "app.services.dashboard_service.risk_repository.get_risk_zone_overview",
        AsyncMock(return_value=[]),
    )

    result = await get_dashboard(session=object())

    assert result.model_performance.metrics == []
    assert result.model_performance.last_trained_at is None
    assert result.recent_field_reports == []
    assert result.risk_zones == []
