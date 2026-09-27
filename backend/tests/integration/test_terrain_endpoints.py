import asyncio
import uuid

import pytest
from httpx2 import ASGITransport, AsyncClient
from pyproj import Transformer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.workers.tasks import terrain_tasks
from app.workers.terrain.constants import AVOID_MAX, MAX_RISK_DELTA
from app.workers.terrain.grid import load_projected_cells

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


def _client() -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    )


async def _create_user(username: str, role: str = "analyst") -> str:
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO users
                    (email, username, first_name, last_name, password_hash,
                     role, is_active)
                VALUES
                    (:email, :username, 'Test', 'User', :pw_hash,
                     CAST(:role AS user_role), TRUE)
                RETURNING id
            """),
            {
                "email": f"{username}@savanna.test",
                "username": username,
                "pw_hash": get_password_hash("SecurePass1!"),
                "role": role,
            },
        )
        return str(result.fetchone()[0])


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


async def _wipe():
    async with _engine.begin() as conn:
        await conn.execute(text("DELETE FROM workspace_memberships"))
        await conn.execute(text("DELETE FROM workspace_features"))
        await conn.execute(text("DELETE FROM workspace_layers"))
        await conn.execute(text("UPDATE workspace_meta SET version = 0"))
        await conn.execute(text("DELETE FROM terrain_cell_effects"))
        await conn.execute(text("DELETE FROM terrain_effects_meta"))
        await conn.execute(
            text("DELETE FROM users WHERE username LIKE 'test_terrain_%'"),
        )


@pytest.fixture(autouse=True)
def cleanup():
    asyncio.run(_wipe())
    yield
    asyncio.run(_wipe())


def _first_cell_centre() -> tuple[str, float, float]:
    cells, epsg = load_projected_cells()
    ref, polygon = cells[0]
    to_lonlat = Transformer.from_crs(
        f"EPSG:{epsg}",
        "EPSG:4326",
        always_xy=True,
    )
    lon, lat = to_lonlat.transform(polygon.centroid.x, polygon.centroid.y)
    return ref, lon, lat


def _workspace_body(base_version, lon, lat, rules):
    layer_id = str(uuid.uuid4())
    feature_id = str(uuid.uuid4())
    return {
        "base_version": base_version,
        "layers": [
            {
                "id": layer_id,
                "name": "Terrain",
                "parent_id": None,
                "order": 0,
                "default_style": {},
            },
        ],
        "features": [
            {
                "id": feature_id,
                "type": "point",
                "name": "Rule holder",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "rules": rules,
            },
        ],
        "memberships": [
            {
                "id": str(uuid.uuid4()),
                "feature_id": feature_id,
                "layer_id": layer_id,
                "order": 0,
                "style_override": {},
                "visible": True,
            },
        ],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    ["/v1/terrain/risk-adjustments", "/v1/terrain/route-costs"],
)
async def test_the_endpoints_reject_unauthenticated_callers(path):
    async with _client() as client:
        response = await client.get(path)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_a_ranger_reads_an_empty_and_fresh_result_on_a_new_system():
    ranger_id = await _create_user("test_terrain_ranger", role="ranger")

    async with _client() as client:
        risk = await client.get(
            "/v1/terrain/risk-adjustments",
            headers=_auth_header(ranger_id),
        )
        route = await client.get(
            "/v1/terrain/route-costs",
            headers=_auth_header(ranger_id),
        )

    for response in (risk, route):
        assert response.status_code == 200
        assert response.json() == {
            "computed_version": None,
            "computed_at": None,
            "stale": False,
            "cells": {},
        }


@pytest.mark.asyncio
async def test_saved_rules_become_cell_effects_the_endpoints_serve():
    analyst_id = await _create_user("test_terrain_analyst")
    ranger_id = await _create_user("test_terrain_reader", role="ranger")
    ref, lon, lat = _first_cell_centre()
    rules = {
        "increase_risk": {"strength": 1.0},
        "avoid": {"strength": 1.0},
    }

    async with _client() as client:
        saved = await client.put(
            "/v1/workspace",
            json=_workspace_body(0, lon, lat, rules),
            headers=_auth_header(analyst_id),
        )
        assert saved.status_code == 200

        result = await terrain_tasks._compute()
        assert result["status"] == "completed"

        risk = await client.get(
            "/v1/terrain/risk-adjustments",
            headers=_auth_header(ranger_id),
        )
        route = await client.get(
            "/v1/terrain/route-costs",
            headers=_auth_header(ranger_id),
        )

    assert risk.json()["stale"] is False
    assert risk.json()["computed_version"] == 1
    assert risk.json()["cells"][ref] == pytest.approx(MAX_RISK_DELTA)
    assert route.json()["cells"][ref] == pytest.approx(AVOID_MAX)


@pytest.mark.asyncio
async def test_removing_the_last_rule_clears_the_effects_after_a_recompute():
    analyst_id = await _create_user("test_terrain_clearer")
    ref, lon, lat = _first_cell_centre()

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json=_workspace_body(0, lon, lat, {"avoid": {"strength": 1.0}}),
            headers=_auth_header(analyst_id),
        )
        await terrain_tasks._compute()

        await client.put(
            "/v1/workspace",
            json=_workspace_body(1, lon, lat, {}),
            headers=_auth_header(analyst_id),
        )
        await terrain_tasks._compute()

        route = await client.get(
            "/v1/terrain/route-costs",
            headers=_auth_header(analyst_id),
        )

    assert route.json()["cells"] == {}
    assert route.json()["stale"] is False
    assert ref not in route.json()["cells"]


@pytest.mark.asyncio
async def test_a_stale_recompute_never_overwrites_a_newer_request():
    analyst_id = await _create_user("test_terrain_superseded")
    _, lon, lat = _first_cell_centre()

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json=_workspace_body(0, lon, lat, {"avoid": {"strength": 1.0}}),
            headers=_auth_header(analyst_id),
        )
        await terrain_tasks._compute()

        await client.put(
            "/v1/workspace",
            json=_workspace_body(1, lon, lat, {"avoid": {"strength": 0.5}}),
            headers=_auth_header(analyst_id),
        )
        async with _Session() as session:
            await session.execute(
                text(
                    "UPDATE terrain_effects_meta "
                    "SET requested_hash = 'a-newer-request'",
                ),
            )
            await session.commit()

        result = await terrain_tasks._compute()
        route = await client.get(
            "/v1/terrain/route-costs",
            headers=_auth_header(analyst_id),
        )

    assert result == {"status": "superseded"}
    assert route.json()["stale"] is True
