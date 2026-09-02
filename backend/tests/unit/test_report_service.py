from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.schemas.report import LocationLatLon, ReportCreate, ReportUpdate
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
    username: str = "ranger1",
) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role="ranger", username=username)


def _admin() -> SimpleNamespace:
    return SimpleNamespace(
        id="cccccccc-0000-0000-0000-000000000001",
        role="admin",
    )


def _fake_user_repo(username: str | None = "ranger1"):
    repo = AsyncMock()
    repo.get_username_by_id.return_value = username
    return repo


def _make_service(report, user_repo=None):
    repo = AsyncMock()
    repo.get_by_id.return_value = report
    return ReportService(repo, user_repo or _fake_user_repo())


def _make_list_service(results, total, user_repo=None):
    repo = AsyncMock()
    repo.get_list.return_value = (results, total)
    return ReportService(repo, user_repo or _fake_user_repo())


def _make_update_service(report, update_result=None, user_repo=None):
    repo = AsyncMock()
    repo.get_by_id.return_value = report
    repo.update.return_value = update_result or {
        "report_id": _REPORT["id"],
        "report_type": _REPORT["report_type"],
        "status": "updated",
        "submitted_by": _REPORT["submitted_by"],
        "created_at": _NOW,
    }
    return ReportService(repo, user_repo or _fake_user_repo())


def _make_delete_service(report, soft_delete_result=True, user_repo=None):
    repo = AsyncMock()
    repo.get_by_id.return_value = report
    repo.soft_delete.return_value = soft_delete_result
    return ReportService(repo, user_repo or _fake_user_repo())


def _make_media_service():
    media_service = MagicMock()
    media_service.generate_view_url.side_effect = lambda url: f"{url}?signed=1"
    return media_service


def _make_create_service(result=None, user_repo=None):
    repo = AsyncMock()
    repo.create.return_value = result or {
        "report_id": "aaaaaaaa-0000-0000-0000-000000000001",
        "report_type": "incident",
        "status": "submitted",
        "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        "created_at": _NOW,
    }
    return ReportService(repo, user_repo or _fake_user_repo())


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


@pytest.mark.asyncio
async def test_create_report_uses_current_user_username_directly():
    user_repo = _fake_user_repo()
    service = _make_create_service(user_repo=user_repo)
    current_user = SimpleNamespace(
        id="bbbbbbbb-0000-0000-0000-000000000001",
        role="ranger",
        username="reporter1",
    )

    result = await service.create_report(current_user, _incident_body())

    assert result["submitted_by_username"] == "reporter1"
    user_repo.get_username_by_id.assert_not_awaited()


# get_report_by_id


@pytest.mark.asyncio
async def test_ranger_gets_own_report():
    service = _make_service(dict(_REPORT))
    result = await service.get_report(_REPORT["id"], _ranger())
    assert result["id"] == _REPORT["id"]


@pytest.mark.asyncio
async def test_ranger_gets_other_rangers_report():
    service = _make_service(dict(_REPORT))
    other = _ranger("dddddddd-0000-0000-0000-000000000001")
    result = await service.get_report(_REPORT["id"], other)
    assert result["id"] == _REPORT["id"]


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


@pytest.mark.asyncio
async def test_get_report_converts_stored_images_to_view_urls():
    report = dict(_REPORT, images=["http://minio/bucket/reports/a.jpg"])
    repo = AsyncMock()
    repo.get_by_id.return_value = report
    media_service = _make_media_service()
    service = ReportService(
        repo,
        _fake_user_repo(),
        media_service=media_service,
    )

    result = await service.get_report(_REPORT["id"], _ranger())

    media_service.generate_view_url.assert_called_once_with(
        "http://minio/bucket/reports/a.jpg",
    )
    assert result["images"] == ["http://minio/bucket/reports/a.jpg?signed=1"]


@pytest.mark.asyncio
async def test_get_report_resolves_submitted_by_username():
    user_repo = _fake_user_repo("field_ranger_3")
    service = _make_service(dict(_REPORT), user_repo=user_repo)

    result = await service.get_report(_REPORT["id"], _admin())

    assert result["submitted_by_username"] == "field_ranger_3"


# get_reports


@pytest.mark.asyncio
async def test_get_reports_ranger_passes_none_owner_to_repo():
    service = _make_list_service([], 0)
    await service.get_reports(_ranger())
    service.repo.get_list.assert_called_once()
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] is None


@pytest.mark.asyncio
async def test_get_reports_admin_passes_none_owner_to_repo():
    service = _make_list_service([], 0)
    await service.get_reports(_admin())
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] is None


@pytest.mark.asyncio
async def test_get_reports_returns_results_and_total():
    items = [
        {
            "report_id": "x",
            "report_type": "incident",
            "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        },
    ]
    service = _make_list_service(items, 1)
    results, total = await service.get_reports(_ranger())
    assert total == 1
    assert results == items


@pytest.mark.asyncio
async def test_get_reports_converts_stored_images_to_view_urls():
    items = [
        {
            "report_id": "x",
            "images": ["http://minio/bucket/reports/a.jpg"],
            "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        },
        {
            "report_id": "y",
            "images": [],
            "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        },
    ]
    repo = AsyncMock()
    repo.get_list.return_value = (items, 2)
    media_service = _make_media_service()
    service = ReportService(
        repo,
        _fake_user_repo(),
        media_service=media_service,
    )

    results, _ = await service.get_reports(_ranger())

    assert results[0]["images"] == [
        "http://minio/bucket/reports/a.jpg?signed=1",
    ]
    assert results[1]["images"] == []


@pytest.mark.asyncio
async def test_get_reports_passes_filters_to_repo():
    service = _make_list_service([], 0)
    await service.get_reports(
        _admin(),
        report_types="incident",
        severities="high",
        page=2,
        page_size=10,
    )
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["report_types"] == "incident"
    assert call_kwargs["severities"] == "high"
    assert call_kwargs["page"] == 2
    assert call_kwargs["page_size"] == 10


@pytest.mark.asyncio
async def test_get_reports_resolves_submitted_by_username():
    user_repo = _fake_user_repo("field_ranger_3")
    service = _make_list_service([dict(_REPORT)], 1, user_repo=user_repo)

    results, _ = await service.get_reports(_admin())

    assert results[0]["submitted_by_username"] == "field_ranger_3"
    user_repo.get_username_by_id.assert_awaited_with(_REPORT["submitted_by"])


# update_report


@pytest.mark.asyncio
async def test_ranger_updates_own_report_calls_repo():
    service = _make_update_service(dict(_REPORT))
    result = await service.update_report(
        _REPORT["id"],
        _ranger(),
        ReportUpdate(description="Updated description"),
    )
    service.repo.update.assert_called_once()
    assert result["status"] == "updated"


@pytest.mark.asyncio
async def test_ranger_blocked_from_updating_other_report():
    service = _make_update_service(dict(_REPORT))
    other = _ranger("dddddddd-0000-0000-0000-000000000001")
    with pytest.raises(HTTPException) as exc:
        await service.update_report(
            _REPORT["id"],
            other,
            ReportUpdate(description="hijacked"),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_updates_any_report():
    service = _make_update_service(dict(_REPORT))
    result = await service.update_report(
        _REPORT["id"],
        _admin(),
        ReportUpdate(description="Admin edit"),
    )
    assert result["status"] == "updated"


@pytest.mark.asyncio
async def test_update_report_resolves_submitted_by_username():
    user_repo = _fake_user_repo("field_ranger_3")
    service = _make_update_service(dict(_REPORT), user_repo=user_repo)

    result = await service.update_report(
        _REPORT["id"],
        _admin(),
        ReportUpdate(description="Admin edit"),
    )

    assert result["submitted_by_username"] == "field_ranger_3"
    user_repo.get_username_by_id.assert_awaited_with(_REPORT["submitted_by"])


@pytest.mark.asyncio
async def test_update_missing_report_returns_none():
    service = _make_update_service(None)
    result = await service.update_report(
        "nonexistent-id",
        _ranger(),
        ReportUpdate(description="doesn't matter"),
    )
    assert result is None


@pytest.mark.asyncio
async def test_update_no_fields_raises_400():
    service = _make_update_service(dict(_REPORT))
    with pytest.raises(HTTPException) as exc:
        await service.update_report(_REPORT["id"], _ranger(), ReportUpdate())
    assert exc.value.status_code == 400
    service.repo.get_by_id.assert_not_called()


@pytest.mark.asyncio
async def test_update_future_occurred_at_raises_422():
    service = _make_update_service(dict(_REPORT))
    body = ReportUpdate(occurred_at=_NOW + timedelta(hours=1))
    with pytest.raises(HTTPException) as exc:
        await service.update_report(_REPORT["id"], _ranger(), body)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_update_invalid_lat_raises_422():
    service = _make_update_service(dict(_REPORT))
    body = ReportUpdate(location=LocationLatLon(lat=91.0, lon=28.1))
    with pytest.raises(HTTPException) as exc:
        await service.update_report(_REPORT["id"], _ranger(), body)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_update_invalid_lon_raises_422():
    service = _make_update_service(dict(_REPORT))
    body = ReportUpdate(location=LocationLatLon(lat=-25.7, lon=181.0))
    with pytest.raises(HTTPException) as exc:
        await service.update_report(_REPORT["id"], _ranger(), body)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_update_passes_wkt_to_repo():
    service = _make_update_service(dict(_REPORT))
    body = ReportUpdate(location=LocationLatLon(lat=-25.7, lon=28.1))
    await service.update_report(_REPORT["id"], _ranger(), body)
    kwargs = service.repo.update.call_args.kwargs
    assert kwargs["fields"]["location_wkt"] == "POINT(28.1 -25.7)"


@pytest.mark.asyncio
async def test_update_incident_fields_included_for_incident_report():
    service = _make_update_service(dict(_REPORT))
    body = ReportUpdate(incident_type="wildfire", severity="high")
    await service.update_report(_REPORT["id"], _ranger(), body)
    kwargs = service.repo.update.call_args.kwargs
    assert kwargs["fields"]["incident_type"] == "wildfire"
    assert kwargs["fields"]["severity"] == "high"


@pytest.mark.asyncio
async def test_update_sighting_fields_included_for_sighting_report():
    sighting_report = dict(_REPORT, report_type="sighting")
    service = _make_update_service(sighting_report)
    body = ReportUpdate(species="lion", count=3)
    await service.update_report(_REPORT["id"], _ranger(), body)
    kwargs = service.repo.update.call_args.kwargs
    assert kwargs["fields"]["species"] == "lion"
    assert kwargs["fields"]["count"] == 3


@pytest.mark.asyncio
async def test_update_naive_datetime_is_treated_as_utc():
    service = _make_update_service(dict(_REPORT))
    naive_past = (_NOW - timedelta(hours=1)).replace(tzinfo=None)
    body = ReportUpdate(occurred_at=naive_past)
    await service.update_report(_REPORT["id"], _ranger(), body)
    service.repo.update.assert_called_once()


# delete_report


@pytest.mark.asyncio
async def test_ranger_deletes_own_report_calls_repo():
    service = _make_delete_service(dict(_REPORT))
    result = await service.delete_report(_REPORT["id"], _ranger())
    service.repo.soft_delete.assert_called_once_with(_REPORT["id"])
    assert result is True


@pytest.mark.asyncio
async def test_ranger_blocked_from_deleting_other_report():
    service = _make_delete_service(dict(_REPORT))
    other = _ranger("dddddddd-0000-0000-0000-000000000001")
    with pytest.raises(HTTPException) as exc:
        await service.delete_report(_REPORT["id"], other)
    assert exc.value.status_code == 403
    service.repo.soft_delete.assert_not_called()


@pytest.mark.asyncio
async def test_admin_deletes_any_report():
    service = _make_delete_service(dict(_REPORT))
    result = await service.delete_report(_REPORT["id"], _admin())
    assert result is True


@pytest.mark.asyncio
async def test_delete_missing_report_returns_false():
    service = _make_delete_service(None)
    result = await service.delete_report("nonexistent-id", _ranger())
    assert result is False
    service.repo.soft_delete.assert_not_called()


@pytest.mark.asyncio
async def test_delete_already_deleted_report_returns_false():
    service = _make_delete_service(dict(_REPORT), soft_delete_result=False)
    result = await service.delete_report(_REPORT["id"], _admin())
    assert result is False


# notifications


def _make_notifying_service(notification_service=None):
    repo = AsyncMock()
    repo.create.return_value = {
        "report_id": "aaaaaaaa-0000-0000-0000-000000000001",
        "report_type": "incident",
        "status": "submitted",
        "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        "created_at": _NOW,
    }
    return ReportService(
        repo,
        _fake_user_repo(),
        notification_service=notification_service or AsyncMock(),
    )


@pytest.mark.asyncio
async def test_create_report_without_notification_service_does_not_error():
    service = _make_create_service()

    await service.create_report(_ranger(), _incident_body())


@pytest.mark.asyncio
async def test_create_report_notifies_analysts_and_admins():
    notification_service = AsyncMock()
    service = _make_notifying_service(notification_service)

    await service.create_report(_ranger(), _incident_body())

    notification_service.notify_roles.assert_called_once()
    args = notification_service.notify_roles.call_args
    assert args.args[0] == ["analyst", "admin"]
    assert args.args[1] == "field_report_submitted"
    assert args.kwargs["related_type"] == "field_report"
    assert args.kwargs["related_id"] == "aaaaaaaa-0000-0000-0000-000000000001"
