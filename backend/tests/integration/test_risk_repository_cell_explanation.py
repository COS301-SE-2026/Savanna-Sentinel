from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.repositories.risk_repository import (
    get_cell_explanation,
    get_grid_cells,
    persist_grid_cells,
    save_heatmap_snapshot,
    save_model_version,
)

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)

_PARK = "klaserie"
_TEST_USER_ID = None
_CREATED_EVENT_IDS: list[str] = []


async def _ensure_test_user():
    global _TEST_USER_ID
    if _TEST_USER_ID:
        return _TEST_USER_ID
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("""
                SELECT id FROM users
                WHERE email = 'test_cell_explain_user@example.com'
            """),
        )
        existing = result.scalar_one_or_none()
        if existing:
            _TEST_USER_ID = existing
            return _TEST_USER_ID
        result = await conn.execute(
            text("""
                INSERT INTO users (
                    email, username, password_hash, first_name,
                    last_name, role, is_active
                )
                VALUES (
                    'test_cell_explain_user@example.com',
                    'test_cell_explain_user', 'dummy_hash', 'Test', 'User',
                    'analyst', true
                )
                RETURNING id
            """),
        )
        _TEST_USER_ID = result.scalar_one()
        return _TEST_USER_ID


async def _clean_park_data():
    global _TEST_USER_ID
    async with _engine.begin() as conn:
        await conn.execute(
            text("""
                DELETE FROM risk_heatmaps WHERE model_id IN (
                    SELECT id FROM risk_models WHERE park_id = :p
                )
            """),
            {"p": _PARK},
        )
        await conn.execute(
            text("DELETE FROM risk_models WHERE park_id = :p"),
            {"p": _PARK},
        )
        if _CREATED_EVENT_IDS:
            await conn.execute(
                text("DELETE FROM geospatial_events WHERE id = ANY(:ids)"),
                {"ids": _CREATED_EVENT_IDS},
            )
            _CREATED_EVENT_IDS.clear()
        await conn.execute(
            text("DELETE FROM grid_cells WHERE park_id = :p"),
            {"p": _PARK},
        )
        if _TEST_USER_ID:
            await conn.execute(
                text("DELETE FROM users WHERE id = :uid"),
                {"uid": _TEST_USER_ID},
            )
            _TEST_USER_ID = None


@pytest.fixture(autouse=True)
async def _cleanup():
    await _clean_park_data()
    yield
    await _clean_park_data()


async def _insert_incident(lng, lat, occurred_at, incident_type, severity):
    async with _engine.begin() as conn:
        ev = await conn.execute(
            text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES ('incident', ST_GeogFromText(:wkt), :occurred_at)
                RETURNING id
            """),
            {"wkt": f"POINT({lng} {lat})", "occurred_at": occurred_at},
        )
        event_id = ev.fetchone()[0]
        _CREATED_EVENT_IDS.append(event_id)
        await conn.execute(
            text("""
                INSERT INTO incidents (id, incident_type, severity)
                VALUES (:id, :incident_type, :severity)
            """),
            {
                "id": event_id,
                "incident_type": incident_type,
                "severity": severity,
            },
        )


async def _insert_sighting(lng, lat, occurred_at, species, count):
    async with _engine.begin() as conn:
        ev = await conn.execute(
            text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES ('sighting', ST_GeogFromText(:wkt), :occurred_at)
                RETURNING id
            """),
            {"wkt": f"POINT({lng} {lat})", "occurred_at": occurred_at},
        )
        event_id = ev.fetchone()[0]
        _CREATED_EVENT_IDS.append(event_id)
        await conn.execute(
            text("""
                INSERT INTO sightings (id, species, count)
                VALUES (:id, :species, :count)
            """),
            {"id": event_id, "species": species, "count": count},
        )


def _cell_center(cell):
    lon, lat = cell["corners"][0]
    far_lon, far_lat = cell["corners"][2]
    return lon + (far_lon - lon) / 2, lat + (far_lat - lat) / 2


async def _create_heatmap_for_cell(session, cell):
    user_id = await _ensure_test_user()
    now = datetime.now(timezone.utc)
    model_id = await save_model_version(
        session,
        _PARK,
        object_storage_key="test-key",
        trained_by=user_id,
        window_start=now - timedelta(days=180),
        window_end=now,
        n_examples=1,
        metrics={},
    )
    heatmap_id, computed_at = await save_heatmap_snapshot(
        session,
        model_id,
        cells=[cell],
        scores={cell["cell_id"]: 0.8},
        features_per_cell={
            cell["cell_id"]: {
                "incident_density_self": 1.0,
                "incident_density_neighbors": 2.0,
                "patrol_recency_days": 5.0,
                "patrol_frequency": 3.0,
            },
        },
        explanations={
            cell["cell_id"]: [("incident_density_self", 0.9)],
        },
    )
    return heatmap_id, computed_at


def _find_neighbor(cells, target, distance=1):
    for cell in cells:
        if cell["cell_id"] == target["cell_id"]:
            continue
        d_row = abs(cell["row"] - target["row"])
        d_col = abs(cell["col"] - target["col"])
        if max(d_row, d_col) == distance:
            return cell
    raise AssertionError(f"No neighbor at distance {distance} found for test")


@pytest.mark.asyncio
async def test_get_cell_explanation_includes_self_and_neighbor_incidents():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    neighbor = _find_neighbor(cells, target, distance=1)

    now = datetime.now(timezone.utc)
    target_lon, target_lat = _cell_center(target)
    neighbor_lon, neighbor_lat = _cell_center(neighbor)

    await _insert_incident(
        target_lon,
        target_lat,
        now - timedelta(days=5),
        "snare",
        "high",
    )
    await _insert_incident(
        neighbor_lon,
        neighbor_lat,
        now - timedelta(days=10),
        "poaching_sign",
        "medium",
    )

    async with _Session() as session:
        await _create_heatmap_for_cell(session, target)
        await session.commit()

    async with _Session() as session:
        result = await get_cell_explanation(session, target["cell_id"])

    assert result is not None
    assert [i["incident_type"] for i in result["self_incidents"]] == ["snare"]
    assert result["self_incidents"][0]["severity"] == "high"
    assert [i["incident_type"] for i in result["neighbor_incidents"]] == [
        "poaching_sign",
    ]
    assert result["neighbor_incidents"][0]["severity"] == "medium"


@pytest.mark.asyncio
async def test_get_cell_explanation_excludes_far_neighbors_and_old_incidents():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    far_cell = _find_neighbor(cells, target, distance=3)

    now = datetime.now(timezone.utc)
    target_lon, target_lat = _cell_center(target)
    far_lon, far_lat = _cell_center(far_cell)

    await _insert_incident(
        target_lon,
        target_lat,
        now - timedelta(days=200),
        "snare",
        "high",
    )
    await _insert_incident(
        far_lon,
        far_lat,
        now - timedelta(days=5),
        "poaching_sign",
        "medium",
    )

    async with _Session() as session:
        await _create_heatmap_for_cell(session, target)
        await session.commit()

    async with _Session() as session:
        result = await get_cell_explanation(session, target["cell_id"])

    assert result is not None
    assert result["self_incidents"] == []
    assert result["neighbor_incidents"] == []


@pytest.mark.asyncio
async def test_get_cell_explanation_includes_self_and_neighbor_sightings():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    neighbor = _find_neighbor(cells, target, distance=1)

    now = datetime.now(timezone.utc)
    target_lon, target_lat = _cell_center(target)
    neighbor_lon, neighbor_lat = _cell_center(neighbor)

    await _insert_sighting(
        target_lon,
        target_lat,
        now - timedelta(days=2),
        "Lion",
        3,
    )
    await _insert_sighting(
        neighbor_lon,
        neighbor_lat,
        now - timedelta(days=4),
        "Elephant",
        1,
    )

    async with _Session() as session:
        await _create_heatmap_for_cell(session, target)
        await session.commit()

    async with _Session() as session:
        result = await get_cell_explanation(session, target["cell_id"])

    assert result is not None
    assert [s["species"] for s in result["self_sightings"]] == ["Lion"]
    assert result["self_sightings"][0]["count"] == 3
    assert [s["species"] for s in result["neighbor_sightings"]] == [
        "Elephant",
    ]


@pytest.mark.asyncio
async def test_get_cell_explanation_excludes_far_and_old_sightings():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    far_cell = _find_neighbor(cells, target, distance=3)

    now = datetime.now(timezone.utc)
    target_lon, target_lat = _cell_center(target)
    far_lon, far_lat = _cell_center(far_cell)

    await _insert_sighting(
        target_lon,
        target_lat,
        now - timedelta(days=200),
        "Lion",
        1,
    )
    await _insert_sighting(
        far_lon,
        far_lat,
        now - timedelta(days=5),
        "Rhino",
        1,
    )

    async with _Session() as session:
        await _create_heatmap_for_cell(session, target)
        await session.commit()

    async with _Session() as session:
        result = await get_cell_explanation(session, target["cell_id"])

    assert result is not None
    assert result["self_sightings"] == []
    assert result["neighbor_sightings"] == []


@pytest.mark.asyncio
async def test_get_cell_explanation_excludes_sightings_past_model_lookback():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]

    now = datetime.now(timezone.utc)
    target_lon, target_lat = _cell_center(target)

    await _insert_sighting(
        target_lon,
        target_lat,
        now - timedelta(days=20),
        "Lion",
        1,
    )

    async with _Session() as session:
        await _create_heatmap_for_cell(session, target)
        await session.commit()

    async with _Session() as session:
        result = await get_cell_explanation(session, target["cell_id"])

    assert result is not None
    assert result["self_sightings"] == []
