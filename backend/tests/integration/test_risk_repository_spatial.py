import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.repositories.risk_repository import (
    fetch_incidents_by_cell,
    fetch_patrol_tracks_by_cell,
    get_grid_cells,
    persist_grid_cells,
)

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)

_PARK = "klaserie"
_TEST_USER_ID = None


async def _ensure_test_user():
    global _TEST_USER_ID
    if _TEST_USER_ID:
        return _TEST_USER_ID
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("""
                SELECT id FROM users
                WHERE email = 'test_tipoff_user@example.com'
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
                    'test_tipoff_user@example.com', 'test_tipoff_user',
                    'dummy_hash', 'Test', 'User', 'community_liaison', true
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
            text("DELETE FROM tipoffs WHERE submitted_by = :uid"),
            {"uid": _TEST_USER_ID} if _TEST_USER_ID else {"uid": None},
        )
        await conn.execute(
            text(
                "DELETE FROM geospatial_events WHERE id IN "
                "(SELECT id FROM incidents) OR id IN "
                "(SELECT id FROM patrol_tracks)",
            ),
        )
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


async def _insert_incident(
    lng,
    lat,
    occurred_at,
    severity="high",
    tag="tipoff",
):
    user_id = await _ensure_test_user()
    wkt = f"POINT({lng} {lat})"
    async with _engine.begin() as conn:
        ev = await conn.execute(
            text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES ('incident', ST_GeogFromText(:wkt), :occurred_at)
                RETURNING id
            """),
            {"wkt": wkt, "occurred_at": occurred_at},
        )
        event_id = ev.fetchone()[0]

        tipoff_id = None
        field_report_id = None
        if tag == "tipoff":
            to = await conn.execute(
                text("""
                    INSERT INTO tipoffs
                        (submitted_by, report_type, description,
                         location, occurred_at)
                    VALUES (:user_id, 'incident', 'test tip',
                        ST_GeogFromText(:wkt), :occurred_at)
                    RETURNING id
                """),
                {"user_id": user_id, "wkt": wkt, "occurred_at": occurred_at},
            )
            tipoff_id = to.fetchone()[0]

        await conn.execute(
            text("""
                INSERT INTO incidents
                    (id, field_report_id, tipoff_id, incident_type, severity)
                VALUES (:id, :fr, :tip, 'snare', :sev)
            """),
            {
                "id": event_id,
                "fr": field_report_id,
                "tip": tipoff_id,
                "sev": severity,
            },
        )


async def _insert_patrol_track(wkt_linestring, occurred_at):
    async with _engine.begin() as conn:
        center_pt = await conn.execute(
            text("SELECT ST_AsText(ST_Centroid(ST_GeomFromText(:wkt, 4326)))"),
            {"wkt": wkt_linestring},
        )
        center_wkt = center_pt.scalar_one()

        ev = await conn.execute(
            text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES (
                    'patrol_track', ST_GeogFromText(:center_wkt),
                    :occurred_at
                )
                RETURNING id
            """),
            {"center_wkt": center_wkt, "occurred_at": occurred_at},
        )
        event_id = ev.fetchone()[0]
        await conn.execute(
            text("""
                INSERT INTO patrol_tracks (id, route_line)
                VALUES (:id, ST_GeogFromText(:wkt))
            """),
            {"id": event_id, "wkt": wkt_linestring},
        )


@pytest.mark.asyncio
async def test_persist_grid_cells_is_idempotent():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        first_cells = await get_grid_cells(session, _PARK)

        await persist_grid_cells(session, _PARK)
        await session.commit()
        second_cells = await get_grid_cells(session, _PARK)

    assert len(first_cells) > 0
    assert len(first_cells) == len(second_cells)


@pytest.mark.asyncio
async def test_persist_grid_cells_survives_concurrent_calls():
    async def _persist():
        async with _Session() as session:
            await persist_grid_cells(session, _PARK)
            await session.commit()

    await asyncio.gather(_persist(), _persist())

    async with _Session() as session:
        cells = await get_grid_cells(session, _PARK)

    assert len(cells) > 0
    cell_ids = [c["cell_id"] for c in cells]
    assert len(cell_ids) == len(set(cell_ids))


@pytest.mark.asyncio
async def test_fetch_incidents_by_cell_groups_by_containing_cell():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    lon, lat = target["corners"][0]
    inside_lon = lon + (target["corners"][2][0] - lon) / 2
    inside_lat = lat + (target["corners"][2][1] - lat) / 2

    now = datetime.now(timezone.utc)
    await _insert_incident(inside_lon, inside_lat, now - timedelta(days=5))

    async with _Session() as session:
        result = await fetch_incidents_by_cell(
            session,
            _PARK,
            now - timedelta(days=90),
        )

    assert target["cell_id"] in result
    assert len(result[target["cell_id"]]) == 1
    assert result[target["cell_id"]][0]["source_tier"] == "tipoff"


@pytest.mark.asyncio
async def test_fetch_incidents_by_cell_excludes_events_before_since():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    lon, lat = target["corners"][0]
    inside_lon = lon + (target["corners"][2][0] - lon) / 2
    inside_lat = lat + (target["corners"][2][1] - lat) / 2

    now = datetime.now(timezone.utc)
    await _insert_incident(inside_lon, inside_lat, now - timedelta(days=200))

    async with _Session() as session:
        result = await fetch_incidents_by_cell(
            session,
            _PARK,
            now - timedelta(days=90),
        )

    assert result.get(target["cell_id"], []) == []


@pytest.mark.asyncio
async def test_fetch_patrol_tracks_by_cell_uses_intersects():
    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    target = cells[0]
    (lon1, lat1), (lon2, lat2) = target["corners"][0], target["corners"][2]
    wkt = f"LINESTRING({lon1} {lat1}, {lon2} {lat2})"
    now = datetime.now(timezone.utc)
    await _insert_patrol_track(wkt, now - timedelta(days=2))

    async with _Session() as session:
        result = await fetch_patrol_tracks_by_cell(
            session,
            _PARK,
            now - timedelta(days=90),
        )

    assert target["cell_id"] in result
    assert len(result[target["cell_id"]]) == 1
