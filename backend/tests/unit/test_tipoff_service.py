from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.schemas.report import LocationLatLon
from app.schemas.tipoff import TipoffCreate
from app.services.media_service import MediaService
from app.services.tipoff_service import TipoffService

_NOW = datetime.now(timezone.utc)

_TIPOFF = {
    "tipoff_id": "aaaaaaaa-0000-0000-0000-000000000001",
    "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
    "report_type": "incident",
    "description": "Poaching activity spotted",
    "location": {"type": "Point", "coordinates": [28.1, -25.7]},
    "occurred_at": _NOW,
    "created_at": _NOW,
    "images": [],
    "status": "submitted",
}


def _community_liaison(
    user_id: str = "bbbbbbbb-0000-0000-0000-000000000001",
    username: str = "liaison1",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=user_id, role="community_liaison",
        username=username,
    )


def _analyst() -> SimpleNamespace:
    return SimpleNamespace(
        id="cccccccc-0000-0000-0000-000000000001",
        role="analyst",
        username="analyst1",
    )


def _admin() -> SimpleNamespace:
    return SimpleNamespace(
        id="dddddddd-0000-0000-0000-000000000001",
        role="admin",
        username="admin1",
    )


def _fake_user_repo(username: str | None = "liaison1"):
    repo = AsyncMock()
    repo.get_username_by_id.return_value = username
    return repo


def _make_create_service(result=None, user_repo=None):
    repo = AsyncMock()
    repo.create.return_value = result or {
        "tipoff_id": "aaaaaaaa-0000-0000-0000-000000000001",
        "report_type": "incident",
        "status": "submitted",
        "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        "created_at": _NOW,
    }
    return TipoffService(repo, user_repo or _fake_user_repo())


def _make_list_service(results, total, user_repo=None):
    repo = AsyncMock()
    repo.get_list.return_value = (results, total)
    return TipoffService(repo, user_repo or _fake_user_repo())


def _incident_body(**overrides) -> TipoffCreate:
    defaults = dict(
        report_type="incident",
        location=LocationLatLon(lat=-25.7, lon=28.1),
        occurred_at=_NOW - timedelta(hours=1),
        description="Poaching spotted",
        incident_type="poaching",
        severity="high",
    )
    defaults.update(overrides)
    return TipoffCreate(**defaults)


def _sighting_body(**overrides) -> TipoffCreate:
    defaults = dict(
        report_type="sighting",
        location=LocationLatLon(lat=-25.7, lon=28.1),
        occurred_at=_NOW - timedelta(hours=1),
        description="Elephant herd",
        species="elephant",
        count=4,
        severity="medium",
    )
    defaults.update(overrides)
    return TipoffCreate(**defaults)


# create_tipoff


@pytest.mark.asyncio
async def test_create_incident_tipoff_calls_repo():
    service = _make_create_service()

    result = await service.create_tipoff(_community_liaison(), _incident_body())

    service.repo.create.assert_called_once()
    assert result["report_type"] == "incident"
    assert result["status"] == "submitted"


@pytest.mark.asyncio
async def test_create_sighting_tipoff_calls_repo():
    service = _make_create_service(
        {
            "tipoff_id": "x",
            "report_type": "sighting",
            "status": "submitted",
            "submitted_by": "y",
            "created_at": _NOW,
        },
    )

    await service.create_tipoff(_community_liaison(), _sighting_body())

    service.repo.create.assert_called_once()


@pytest.mark.asyncio
async def test_future_occurred_at_raises_422():
    service = _make_create_service()
    body = _incident_body(occurred_at=_NOW + timedelta(hours=1))

    with pytest.raises(HTTPException) as exc:
        await service.create_tipoff(_community_liaison(), body)

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_invalid_lat_raises_422():
    service = _make_create_service()
    body = _incident_body(location=LocationLatLon(lat=91.0, lon=28.1))

    with pytest.raises(HTTPException) as exc:
        await service.create_tipoff(_community_liaison(), body)

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_invalid_lon_raises_422():
    service = _make_create_service()
    body = _incident_body(location=LocationLatLon(lat=-25.7, lon=181.0))

    with pytest.raises(HTTPException) as exc:
        await service.create_tipoff(_community_liaison(), body)

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_incident_missing_incident_type_raises_400():
    service = _make_create_service()
    body = _incident_body(incident_type=None)

    with pytest.raises(HTTPException) as exc:
        await service.create_tipoff(_community_liaison(), body)

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_sighting_missing_species_raises_400():
    service = _make_create_service()
    body = _sighting_body(species=None)

    with pytest.raises(HTTPException) as exc:
        await service.create_tipoff(_community_liaison(), body)

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_tipoff_passes_correct_wkt_to_repo():
    service = _make_create_service()

    await service.create_tipoff(_community_liaison(), _incident_body())

    kwargs = service.repo.create.call_args.kwargs
    assert kwargs["location_wkt"] == "POINT(28.1 -25.7)"


@pytest.mark.asyncio
async def test_create_tipoff_passes_user_id_to_repo():
    service = _make_create_service()

    await service.create_tipoff(_community_liaison(), _incident_body())

    kwargs = service.repo.create.call_args.kwargs
    assert kwargs["user_id"] == "bbbbbbbb-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_create_tipoff_naive_datetime_is_treated_as_utc():
    service = _make_create_service()
    naive_past = (_NOW - timedelta(hours=1)).replace(tzinfo=None)
    body = _incident_body(occurred_at=naive_past)

    await service.create_tipoff(_community_liaison(), body)

    service.repo.create.assert_called_once()


@pytest.mark.asyncio
async def test_create_tipoff_uses_current_user_username_directly():
    user_repo = _fake_user_repo()
    service = _make_create_service(user_repo=user_repo)
    current_user = SimpleNamespace(
        id="bbbbbbbb-0000-0000-0000-000000000001",
        role="community_liaison",
        username="reporter1",
    )

    result = await service.create_tipoff(current_user, _incident_body())

    assert result["submitted_by_username"] == "reporter1"
    user_repo.get_username_by_id.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_tipoff_forwards_all_fields_to_repo():
    service = _make_create_service()
    body = _incident_body(
        description="Wildlife attack report",
        severity="medium",
        species="rhino",
        count=2,
        images=["https://img.example/1.jpg"],
    )

    await service.create_tipoff(_community_liaison(), body)

    kwargs = service.repo.create.call_args.kwargs
    assert kwargs["description"] == "Wildlife attack report"
    assert kwargs["severity"] == "medium"
    assert kwargs["species"] == "rhino"
    assert kwargs["count"] == 2
    assert kwargs["images"] == ["https://img.example/1.jpg"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("lat", "lon"),
    [(-90.1, 28.1), (-25.7, -180.1)],
)
async def test_coordinate_lower_bounds_are_rejected(lat, lon):
    service = _make_create_service()
    body = _incident_body(location=LocationLatLon(lat=lat, lon=lon))

    with pytest.raises(HTTPException) as exc:
        await service.create_tipoff(_community_liaison(), body)

    assert exc.value.status_code == 422


# get_tipoffs


@pytest.mark.asyncio
async def test_community_liaison_gets_only_own_tipoffs():
    service = _make_list_service([], 0)

    await service.get_tipoffs(_community_liaison())

    service.repo.get_list.assert_called_once()
    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] == "bbbbbbbb-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_analyst_gets_all_tipoffs():
    service = _make_list_service([], 0)

    await service.get_tipoffs(_analyst())

    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] is None


@pytest.mark.asyncio
async def test_admin_gets_all_tipoffs():
    service = _make_list_service([], 0)

    await service.get_tipoffs(_admin())

    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["owner_id"] is None


@pytest.mark.asyncio
async def test_get_tipoffs_returns_results_and_total():
    items = [
        {
            "tipoff_id": "x",
            "report_type": "incident",
            "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        },
    ]
    service = _make_list_service(items, 1)

    results, total = await service.get_tipoffs(_admin())

    assert total == 1
    assert results == items


@pytest.mark.asyncio
async def test_get_tipoffs_converts_stored_images_to_view_urls():
    items = [
        {
            "tipoff_id": "x",
            "images": ["http://minio/bucket/tipoffs/a.jpg"],
            "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        },
        {
            "tipoff_id": "y",
            "images": [],
            "submitted_by": "bbbbbbbb-0000-0000-0000-000000000001",
        },
    ]
    repo = AsyncMock()
    repo.get_list.return_value = (items, 2)
    media_service = MagicMock()
    media_service.generate_view_url.side_effect = lambda url: f"{url}?signed=1"
    service = TipoffService(
        repo,
        _fake_user_repo(),
        media_service=media_service,
    )

    results, _ = await service.get_tipoffs(_admin())

    assert results[0]["images"] == ["http://minio/bucket/tipoffs/a.jpg?signed=1"]
    assert results[1]["images"] == []


@pytest.mark.asyncio
async def test_get_tipoffs_handles_none_images_safely():
    repo = AsyncMock()
    repo.get_list.return_value = (
        [{"tipoff_id": "x", "images": None, "submitted_by": "id-1"}],
        1,
    )
    service = TipoffService(repo, _fake_user_repo())

    results, _ = await service.get_tipoffs(_admin())

    assert results[0]["images"] == []


@pytest.mark.asyncio
async def test_get_tipoffs_uses_repo_username_without_n_plus_1():
    user_repo = _fake_user_repo("field_liaison_3")
    service = _make_list_service(
        [{**dict(_TIPOFF), "submitted_by_username": "field_liaison_3"}],
        1,
        user_repo=user_repo,
    )

    results, _ = await service.get_tipoffs(_admin())

    assert results[0]["submitted_by_username"] == "field_liaison_3"
    user_repo.get_username_by_id.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_tipoffs_passes_filters_to_repo():
    service = _make_list_service([], 0)
    from_dt = _NOW - timedelta(days=3)
    to_dt = _NOW

    await service.get_tipoffs(
        _admin(),
        report_type="incident",
        from_dt=from_dt,
        to_dt=to_dt,
        page=2,
        page_size=10,
    )

    call_kwargs = service.repo.get_list.call_args.kwargs
    assert call_kwargs["report_type"] == "incident"
    assert call_kwargs["from_dt"] == from_dt
    assert call_kwargs["to_dt"] == to_dt
    assert call_kwargs["page"] == 2
    assert call_kwargs["page_size"] == 10


def test_service_instantiates_default_media_service():
    service = TipoffService(AsyncMock(), AsyncMock())

    assert isinstance(service.media_service, MediaService)
