"""Real-Postgres integration tests for dashboard_repository.

PostGIS functions (ST_Area, ST_Intersects) don't exist in SQLite, so these run
against the real Postgres instance via the db_session/engine fixtures in
tests/integration/conftest.py. Inserts are left uncommitted on purpose:
db_session's teardown closes the session without committing, which rolls back
everything the test wrote and gives each test a clean slate with no manual
cleanup fixture required.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.repositories.dashboard_repository import (
    get_operational_stats,
    get_patrol_coverage,
    get_recent_field_reports,
    get_report_trends,
)
from app.repositories.risk_repository import get_grid_cells, persist_grid_cells

_PARK = "klaserie"


async def _create_user(session, username, role="ranger", is_active=True) -> str:
    result = await session.execute(
        text("""
            INSERT INTO users
                (email, username, first_name, last_name, password_hash,
                 role, is_active)
            VALUES
                (:email, :username, 'Test', 'User', 'dummy_hash', :role,
                 :is_active)
            RETURNING id
        """),
        {
            "email": f"{username}@savanna.test",
            "username": username,
            "role": role,
            "is_active": is_active,
        },
    )
    return str(result.scalar_one())


async def _create_field_report(
    session,
    user_id,
    report_type="incident",
    occurred_at=None,
    lng=28.1,
    lat=-25.7,
) -> str:
    wkt = f"POINT({lng} {lat})"
    result = await session.execute(
        text("""
            INSERT INTO field_reports
                (submitted_by, report_type, description, location, occurred_at)
            VALUES
                (:uid, :report_type, 'Test report', ST_GeogFromText(:wkt),
                 COALESCE(:occurred_at, NOW()))
            RETURNING id
        """),
        {
            "uid": user_id,
            "report_type": report_type,
            "wkt": wkt,
            "occurred_at": occurred_at,
        },
    )
    return str(result.scalar_one())


async def _create_tipoff(session, user_id, lng=28.1, lat=-25.7) -> str:
    wkt = f"POINT({lng} {lat})"
    result = await session.execute(
        text("""
            INSERT INTO tipoffs
                (submitted_by, report_type, description, location, occurred_at)
            VALUES (:uid, 'incident', 'Test tipoff', ST_GeogFromText(:wkt), NOW())
            RETURNING id
        """),
        {"uid": user_id, "wkt": wkt},
    )
    return str(result.scalar_one())


async def _create_patrol_track(session, wkt_linestring, occurred_at=None) -> str:
    occurred_at = occurred_at or datetime.now(timezone.utc)
    center = await session.execute(
        text("SELECT ST_AsText(ST_Centroid(ST_GeomFromText(:wkt, 4326)))"),
        {"wkt": wkt_linestring},
    )
    center_wkt = center.scalar_one()
    ev = await session.execute(
        text("""
            INSERT INTO geospatial_events (event_type, location, occurred_at)
            VALUES ('patrol_track', ST_GeogFromText(:center_wkt), :occurred_at)
            RETURNING id
        """),
        {"center_wkt": center_wkt, "occurred_at": occurred_at},
    )
    event_id = ev.scalar_one()
    await session.execute(
        text("""
            INSERT INTO patrol_tracks (id, route_line)
            VALUES (:id, ST_GeogFromText(:wkt))
        """),
        {"id": event_id, "wkt": wkt_linestring},
    )
    return str(event_id)


@pytest.mark.asyncio
async def test_get_operational_stats_counts_correctly(db_session, engine):
    since = datetime.now(timezone.utc) - timedelta(days=7)

    uid = await _create_user(db_session, "test_dashboard_stats_ranger")
    await _create_field_report(db_session, uid)
    await _create_tipoff(db_session, uid)
    await _create_patrol_track(db_session, "LINESTRING(28.10 -25.70, 28.11 -25.71)")

    stats = await get_operational_stats(db_session, _PARK, since)

    # get_operational_stats counts globally (no park scoping), so this can't
    # assert an exact count without risking flakes against other committed
    # rows in the shared DB -- see the ==1 note in the follow-up summary.
    assert stats["reports_this_week"] >= 1
    assert stats["tipoffs_this_week"] >= 1
    assert stats["patrols_this_week"] >= 1
    assert stats["active_rangers"] >= 1


@pytest.mark.asyncio
async def test_get_patrol_coverage_returns_zero_when_no_tracks(db_session):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    await persist_grid_cells(db_session, _PARK)

    covered, total = await get_patrol_coverage(db_session, _PARK, since)

    assert covered == 0
    assert total > 0


@pytest.mark.asyncio
async def test_get_patrol_coverage_counts_intersecting_cell_area(db_session):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    await persist_grid_cells(db_session, _PARK)
    cells = await get_grid_cells(db_session, _PARK)
    target = cells[0]
    (lon1, lat1), (lon2, lat2) = target["corners"][0], target["corners"][2]
    wkt = f"LINESTRING({lon1} {lat1}, {lon2} {lat2})"
    await _create_patrol_track(db_session, wkt)

    covered, total = await get_patrol_coverage(db_session, _PARK, since)

    assert covered > 0
    assert covered <= total


@pytest.mark.asyncio
async def test_get_report_trends_groups_by_day_and_type(db_session):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    day1 = datetime.now(timezone.utc) - timedelta(days=2)
    day2 = datetime.now(timezone.utc) - timedelta(days=1)
    uid = await _create_user(db_session, "test_dashboard_trends_ranger")

    await _create_field_report(db_session, uid, report_type="incident", occurred_at=day1)
    await _create_field_report(db_session, uid, report_type="incident", occurred_at=day1)
    await _create_field_report(db_session, uid, report_type="sighting", occurred_at=day2)

    counts_by_type, trend = await get_report_trends(db_session, since)

    # counts_by_type ignores `since` entirely (all-time totals), so we can
    # only assert our two incidents are reflected in the total, not that the
    # total equals 2 -- see the follow-up summary for the same caveat.
    incident_count = next(
        r["count"] for r in counts_by_type if r["report_type"] == "incident"
    )
    assert incident_count >= 2
    assert len(trend) == 2


@pytest.mark.asyncio
async def test_get_recent_field_reports_includes_ranger_and_zone(db_session):
    await persist_grid_cells(db_session, _PARK)
    cells = await get_grid_cells(db_session, _PARK)
    target = cells[0]
    lons = [corner[0] for corner in target["corners"]]
    lats = [corner[1] for corner in target["corners"]]
    center_lng = sum(lons) / len(lons)
    center_lat = sum(lats) / len(lats)

    uid = await _create_user(db_session, "test_dashboard_recent_ranger")
    await _create_field_report(
        db_session,
        uid,
        report_type="incident",
        lng=center_lng,
        lat=center_lat,
    )

    reports = await get_recent_field_reports(db_session, _PARK, limit=5)

    assert len(reports) >= 1
    latest = reports[0]
    assert latest["ranger"] == "test_dashboard_recent_ranger"
    assert latest["report_type"] == "incident"
    assert latest["zone"] == f"Zone {target['row'] + 1}-{target['col'] + 1}"


@pytest.mark.asyncio
async def test_get_recent_field_reports_orders_most_recent_first(db_session):
    older = datetime.now(timezone.utc) - timedelta(days=2)
    newer = datetime.now(timezone.utc) - timedelta(hours=1)
    uid = await _create_user(db_session, "test_dashboard_recent_order")
    await _create_field_report(db_session, uid, occurred_at=older)
    await _create_field_report(db_session, uid, occurred_at=newer)

    reports = await get_recent_field_reports(db_session, _PARK, limit=5)

    assert reports[0]["occurred_at"] >= reports[1]["occurred_at"]
