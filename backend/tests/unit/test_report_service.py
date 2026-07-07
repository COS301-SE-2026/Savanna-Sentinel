from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.schemas.report import LocationLatLon, ReportCreate
from app.services.report_service import ReportService

_NOW = datetime.now(timezone.utc)

_REPORT = {
    "id": "aaaaaaaa-0000-0000-0000-000000000001",
    "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
    "route_id": None,
    "report_type": "incident",
    "description": "Poaching activity spotted",
    "location": {"type": "Point", "coordinates": [28.1, -25.7]},
    "occurred_at": _NOW,
    "created_at": _NOW,
    "updated_at": _NOW,
    "images": [],
}


def _ranger(
    user_id: str = "bbbbbbbb-0000-0000-0000-000000000001",
) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role="ranger")


def _admin() -> SimpleNamespace:
    return SimpleNamespace(
        id="cccccccc-0000-0000-0000-000000000001",
        role="admin",
    )


def _make_service(report):
    repo = AsyncMock()
    repo.get_by_id.return_value = report
    return ReportService(repo)


def _make_list_service(results, total):
    repo = AsyncMock()
    repo.get_list.return_value = (results, total)
    return ReportService(repo)


def _make_create_service(result=None):
    repo = AsyncMock()
    repo.create.return_value = result or {
        "report_id": "aaaaaaaa-0000-0000-0000-000000000001",
        "report_type": "incident",
        "status": "submitted",
        "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        "created_at": _NOW,
    }
    return ReportService(repo)


def _incident_body(**overrides) -> ReportCreate:
    defaults = dict(
        report_type="incident",
        location=LocationLatLon(lat=-25.7, lon=28.1),
        occurred_at=_NOW - timedelta(hours=1),
        description="Poaching spotted",
        incident_type="poaching",
    )
    defaults.update(overrides)
    return ReportCreate(**defaults)


def _sighting_body(**overrides) -> ReportCreate:
    defaults = dict(
        report_type="sighting",
        location=LocationLatLon(lat=-25.7, lon=28.1),
        occurred_at=_NOW - timedelta(hours=1),
        description="Elephant herd",
        species="elephant",
    )
    defaults.update(overrides)
    return ReportCreate(**defaults)


# create_report


@pytest.mark.asyncio
async def test_create_incident_report_calls_repo():
    service = _make_create_service()
    result = await service.create_report(_ranger(), _incident_body())
    service.repo.create.assert_called_once()
    assert result["report_type"] == "incident"
    assert result["status"] == "submitted"


@pytest.mark.asyncio
async def test_create_sighting_report_calls_repo():
    svc = _make_create_service(
        {
            "report_id": "x",
            "report_type": "sighting",
            "status": "submitted",
            "submitted_by": "y",
            "created_at": _NOW,
        },
    )
    await svc.create_report(_ranger(), _sighting_body())
    svc.repo.create.assert_called_once()


@pytest.mark.asyncio
async def test_future_occurred_at_raises_422():
    svc = _make_create_service()
    body = _incident_body(occurred_at=_NOW + timedelta(hours=1))
    with pytest.raises(HTTPException) as exc:
        await svc.create_report(_ranger(), body)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_invalid_lat_raises_422():
    svc = _make_create_service()
    body = _incident_body(location=LocationLatLon(lat=91.0, lon=28.1))
    with pytest.raises(HTTPException) as exc:
        await svc.create_report(_ranger(), body)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_invalid_lon_raises_422():
    svc = _make_create_service()
    body = _incident_body(location=LocationLatLon(lat=-25.7, lon=181.0))
    with pytest.raises(HTTPException) as exc:
        await svc.create_report(_ranger(), body)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_incident_missing_incident_type_raises_400():
    svc = _make_create_service()
    body = _incident_body(incident_type=None)
    with pytest.raises(HTTPException) as exc:
        await svc.create_report(_ranger(), body)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_sighting_missing_species_raises_400():
    svc = _make_create_service()
    body = _sighting_body(species=None)
    with pytest.raises(HTTPException) as exc:
        await svc.create_report(_ranger(), body)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_passes_correct_wkt_to_repo():
    svc = _make_create_service()
    body = _incident_body(location=LocationLatLon(lat=-25.7, lon=28.1))
    await svc.create_report(_ranger(), body)
    kwargs = svc.repo.create.call_args.kwargs
    assert kwargs["location_wkt"] == "POINT(28.1 -25.7)"


@pytest.mark.asyncio
async def test_create_passes_user_id_to_repo():
    svc = _make_create_service()
    await svc.create_report(_ranger(), _incident_body())
    kwargs = svc.repo.create.call_args.kwargs
    assert kwargs["user_id"] == "bbbbbbbb-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_create_naive_datetime_is_treated_as_utc():
    svc = _make_create_service()
    naive_past = (_NOW - timedelta(hours=1)).replace(tzinfo=None)
    body = _incident_body(occurred_at=naive_past)
    await svc.create_report(_ranger(), body)
    svc.repo.create.assert_called_once()


# get_report_by_id


@pytest.mark.asyncio
async def test_ranger_gets_own_report():
    service = _make_service(dict(_REPORT))
    result = await service.get_report(_REPORT["id"], _ranger())
    assert result["id"] == _REPORT["id"]


@pytest.mark.asyncio
async def test_ranger_blocked_from_other_report():
    service = _make_service(dict(_REPORT))
    other = _ranger("dddddddd-0000-0000-0000-000000000001")
    with pytest.raises(HTTPException) as exc:
        await service.get_report(_REPORT["id"], other)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_gets_any_report():
    service = _make_service(dict(_REPORT))
    result = await service.get_report(_REPORT["id"], _admin())
    assert result["id"] == _REPORT["id"]


@pytest.mark.asyncio
async def test_returns_none_when_report_missing():
    service = _make_service(None)
    result = await service.get_report("nonexistent-id", _ranger())
    assert result is None


@pytest.mark.asyncio
async def test_admin_gets_none_for_missing_report():
    service = _make_service(None)
    result = await service.get_report("nonexistent-id", _admin())
    assert result is None


# get_reports


@pytest.mark.asyncio
async def test_get_reports_ranger_passes_own_id_to_repo():
    service = _make_list_service([], 0)
    await service.get_reports(_ranger())
    service.repo.get_list.assert_called_once()
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] == "bbbbbbbb-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_get_reports_admin_passes_none_owner_to_repo():
    service = _make_list_service([], 0)
    await service.get_reports(_admin())
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] is None


@pytest.mark.asyncio
async def test_get_reports_returns_results_and_total():
    items = [{"report_id": "x", "report_type": "incident"}]
    service = _make_list_service(items, 1)
    results, total = await service.get_reports(_ranger())
    assert total == 1
    assert results == items


@pytest.mark.asyncio
async def test_get_reports_passes_filters_to_repo():
    service = _make_list_service([], 0)
    await service.get_reports(
        _admin(),
        report_type="incident",
        severity="high",
        page=2,
        page_size=10,
    )
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["report_type"] == "incident"
    assert call_kwargs["severity"] == "high"
    assert call_kwargs["page"] == 2
    assert call_kwargs["page_size"] == 10
