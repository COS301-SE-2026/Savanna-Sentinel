import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.repositories.patrol_route_repository import PatrolRouteRepository


@pytest_asyncio.fixture
async def user(db_session, engine):
    u = User(
        username="test_patrol_route_repo_user",
        email="test_patrol_route_repo_user@example.com",
        first_name="Test",
        last_name="User",
        hashed_password="hashed",  # NOSONAR
        role="ranger",
        is_active=True,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    # tests may roll back, expiring u
    user_id = u.id

    yield u

    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM patrol_routes WHERE requested_by = :id"),
            {"id": user_id},
        )
        await conn.execute(
            text("DELETE FROM users WHERE id = :id"), {"id": user_id},
        )


@pytest.mark.asyncio
async def test_create_and_list_by_user(db_session, user):
    repo = PatrolRouteRepository(db_session)
    result = await repo.create(
        user_id=user.id,
        request_id=str(uuid.uuid4()),
        start_point_wkt="POINT(31.18 -24.2)",
        end_point_wkt="POINT(31.19 -24.21)",
        risk_heatmap={"cell-1": 0.5, "cell-2": 0.9},
        path_wkt="LINESTRING(31.18 -24.2, 31.19 -24.21)",
        distance_km=90,
        risk_coverage=0.7,
    )
    assert result["id"] is not None

    routes, total = await repo.list_by_user(user.id, page=1, page_size=20)
    assert total == 1
    assert routes[0]["path_geometry"]["type"] == "LineString"
    assert routes[0]["end_point"]["type"] == "Point"
    assert routes[0]["risk_heatmap"] == {"cell-1": 0.5, "cell-2": 0.9}


@pytest.mark.asyncio
async def test_delete_removes_route_owned_by_user(db_session, user):
    repo = PatrolRouteRepository(db_session)
    created = await repo.create(
        user_id=user.id,
        request_id=str(uuid.uuid4()),
        start_point_wkt="POINT(31.18 -24.2)",
        end_point_wkt="POINT(31.19 -24.21)",
        risk_heatmap={"cell-1": 0.5},
        path_wkt="LINESTRING(31.18 -24.2, 31.19 -24.21)",
        distance_km=90,
        risk_coverage=0.7,
    )

    deleted = await repo.delete(created["id"], user.id)
    assert deleted is True

    _, total = await repo.list_by_user(user.id, page=1, page_size=20)
    assert total == 0

    deleted_again = await repo.delete(created["id"], user.id)
    assert deleted_again is False


def _route_kwargs(user, **overrides) -> dict:
    kwargs = {
        "user_id": user.id,
        "request_id": str(uuid.uuid4()),
        "start_point_wkt": "POINT(31.18 -24.2)",
        "end_point_wkt": "POINT(31.19 -24.21)",
        "risk_heatmap": {},
        "path_wkt": "LINESTRING(31.18 -24.2, 31.185 -24.205, 31.19 -24.21)",
        "distance_km": 12,
        "risk_coverage": 0.4,
    }
    kwargs.update(overrides)
    return kwargs


@pytest.mark.asyncio
async def test_create_persists_waypoints_in_order(db_session, user):
    repo = PatrolRouteRepository(db_session)
    await repo.create(**_route_kwargs(
        user,
        waypoints_wkt="MULTIPOINT((31.185 -24.205), (31.182 -24.207))",
    ))

    routes, _ = await repo.list_by_user(user.id, page=1, page_size=20)
    assert routes[0]["waypoints"]["type"] == "MultiPoint"
    assert routes[0]["waypoints"]["coordinates"] == [
        [31.185, -24.205],
        [31.182, -24.207],
    ]


@pytest.mark.asyncio
async def test_create_without_waypoints_stores_null(db_session, user):
    repo = PatrolRouteRepository(db_session)
    await repo.create(**_route_kwargs(user))

    routes, _ = await repo.list_by_user(user.id, page=1, page_size=20)
    assert routes[0]["waypoints"] is None


@pytest.mark.asyncio
async def test_more_than_five_waypoints_is_rejected(db_session, user):
    repo = PatrolRouteRepository(db_session)
    six = ", ".join(f"(31.18{i} -24.2)" for i in range(6))
    with pytest.raises(IntegrityError):
        await repo.create(
            **_route_kwargs(user, waypoints_wkt=f"MULTIPOINT({six})"),
        )
    await db_session.rollback()
