from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

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


def _ranger(user_id: str = "bbbbbbbb-0000-0000-0000-000000000001") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role="ranger")


def _admin() -> SimpleNamespace:
    return SimpleNamespace(id="cccccccc-0000-0000-0000-000000000001", role="admin")


def _make_service(report):
    repo = AsyncMock()
    repo.get_by_id.return_value = report
    return ReportService(repo)


@pytest.mark.asyncio
async def test_ranger_gets_own_report():
    service = _make_service(dict(_REPORT))
    result = await service.get_report(_REPORT["id"], _ranger())
    assert result["id"] == _REPORT["id"]


@pytest.mark.asyncio
async def test_ranger_blocked_from_other_report():
    service = _make_service(dict(_REPORT))
    with pytest.raises(HTTPException) as exc:
        await service.get_report(
            _REPORT["id"], _ranger("dddddddd-0000-0000-0000-000000000001")
        )
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
