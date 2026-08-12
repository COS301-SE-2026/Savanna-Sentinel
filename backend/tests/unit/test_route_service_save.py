from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.geo import GeoLineString, GeoPoint
from app.schemas.route import PlannedRoute, SaveRouteRequest
from app.services.route_service import list_saved_routes, save_route

_NOW = datetime.now(timezone.utc)


def _fake_user(user_id: str = "user-1") -> SimpleNamespace:
    return SimpleNamespace(id=user_id)


def _fake_save_request(request_id: str = "req-1") -> SaveRouteRequest:
    return SaveRouteRequest(
        request_id=request_id,
        start_point=GeoPoint(coordinates=(31.18, -24.2)),
        max_time=120.0,
        max_fuel=40.0,
        route=PlannedRoute(
            suggested_path=["a", "b"],
            path_geometry=GeoLineString(
                coordinates=[(31.18, -24.2), (31.19, -24.21)],
            ),
            estimated_time_min=90.0,
            estimated_fuel_l=30.0,
            risk_coverage=0.7,
        ),
    )


_mock_db = MagicMock()


@pytest.mark.asyncio
@patch("app.services.route_service.PatrolRouteRepository")
async def test_save_route_converts_geometry_to_wkt_correctly(mock_repo_cls):
    mock_repo = AsyncMock()
    mock_repo.create.return_value = {"id": "route-1", "created_at": _NOW}
    mock_repo_cls.return_value = mock_repo

    result = await save_route(_mock_db, _fake_user(), _fake_save_request())

    assert result.id == "route-1"
    mock_repo.create.assert_awaited_once()
    call_kwargs = mock_repo.create.await_args.kwargs
    assert call_kwargs["start_point_wkt"].startswith("POINT(")
    assert call_kwargs["path_wkt"].startswith("LINESTRING(")


@pytest.mark.asyncio
@patch("app.services.route_service.PatrolRouteRepository")
async def test_list_saved_routes_scopes_to_current_user(mock_repo_cls):
    mock_repo = AsyncMock()
    mock_repo.list_by_user.return_value = ([], 0)
    mock_repo_cls.return_value = mock_repo

    await list_saved_routes(_mock_db, _fake_user(user_id="user-9"), 1, 20)

    mock_repo.list_by_user.assert_awaited_once_with("user-9", 1, 20)
