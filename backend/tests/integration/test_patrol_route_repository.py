import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text

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

    yield u

    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM patrol_routes WHERE requested_by = :id"),
            {"id": u.id},
        )
        await conn.execute(
            text("DELETE FROM users WHERE id = :id"), {"id": u.id},
        )


@pytest.mark.asyncio
async def test_create_and_list_by_user(db_session, user):
    repo = PatrolRouteRepository(db_session)
    result = await repo.create(
        user_id=user.id,
        request_id=str(uuid.uuid4()),
        start_point_wkt="POINT(31.18 -24.2)",
        end_point_wkt="POINT(31.19 -24.21)",
        max_time=120,
        max_fuel=40,
        risk_heatmap={"cell-1": 0.5, "cell-2": 0.9},
        path_wkt="LINESTRING(31.18 -24.2, 31.19 -24.21)",
        estimated_time=90,
        estimated_fuel=30,
        risk_coverage=0.7,
    )
    assert result["id"] is not None

    routes, total = await repo.list_by_user(user.id, page=1, page_size=20)
    assert total == 1
    assert routes[0]["path_geometry"]["type"] == "LineString"
    assert routes[0]["end_point"]["type"] == "Point"
    assert routes[0]["risk_heatmap"] == {"cell-1": 0.5, "cell-2": 0.9}
