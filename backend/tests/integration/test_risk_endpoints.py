import asyncio
import json
import shutil
from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.repositories.risk_repository import GRID_FILE_PATH

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


async def _create_user(username: str, role: str = "ranger") -> str:
    async with _Session() as session:
        async with session.begin():
            result = await session.execute(
                text("""
                    INSERT INTO users
                        (email, username, first_name, last_name, password_hash,
                     role, is_active)
                    VALUES
                        (:email, :username, 'Test', 'User', :pw_hash, :role,
                     true)
                    ON CONFLICT (username) DO NOTHING
                    RETURNING id
                """),
                {
                    "email": f"{username}@savanna.test",
                    "username": username,
                    "pw_hash": get_password_hash("SecurePass1!"),
                    "role": role,
                },
            )
            row = result.fetchone()
            if row:
                return str(row[0])
            r2 = await session.execute(
                text("SELECT id FROM users WHERE username = :u"),
                {"u": username},
            )
            return str(r2.fetchone()[0])


def _auth_header(user_id: str) -> dict:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


@asynccontextmanager
async def _rolled_back_connection():
    """Run the app on one connection whose work is all rolled back."""
    async with _engine.connect() as conn:
        transaction = await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        async def _get_db():
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = _get_db
        try:
            yield conn
        finally:
            app.dependency_overrides[get_db] = _override_get_db
            await transaction.rollback()


async def _audit_entries(conn, actor_id: str) -> list[tuple]:
    result = await conn.execute(
        text("""
            SELECT action, target_type, target_id, details
            FROM audit_logs
            WHERE actor_id = :actor_id AND target_type = 'park_grid'
            ORDER BY created_at
        """),
        {"actor_id": actor_id},
    )
    return [tuple(row) for row in result.fetchall()]


@pytest.fixture(autouse=True)
def no_terrain_recompute():
    """Keep grid uploads from sending terrain jobs to the live worker."""
    with patch("app.api.v1.risk.enqueue_recompute_quietly"):
        yield


@pytest.fixture(autouse=True)
def cleanup():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(
                text("""
                    DELETE FROM refresh_tokens
                    WHERE user_id IN (
                        SELECT id FROM users WHERE username LIKE 'test_%'
                    )
                """),
            )
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_%'"),
            )

    asyncio.run(_delete())


@pytest.fixture
def backup_grid_file():
    backup_path = GRID_FILE_PATH.parent / f"{GRID_FILE_PATH.name}.test_bak"

    if GRID_FILE_PATH.exists():
        shutil.copy(GRID_FILE_PATH, backup_path)
        GRID_FILE_PATH.unlink()

    yield GRID_FILE_PATH

    if GRID_FILE_PATH.exists():
        GRID_FILE_PATH.unlink()

    if backup_path.exists():
        shutil.move(backup_path, GRID_FILE_PATH)


@pytest.fixture
def sample_geojson():
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [36.8219, -1.2921],
                            [36.8329, -1.2921],
                            [36.8329, -1.2811],
                            [36.8219, -1.2811],
                            [36.8219, -1.2921],
                        ],
                    ],
                },
            },
        ],
    }
    return json.dumps(geojson_data).encode("utf-8")


@pytest.mark.asyncio
async def test_get_grid_returns_all_klaserie_cells():
    uid = await _create_user("test_ranger_grid1")
    async with _client() as c:
        r = await c.get("/v1/risk/grid", headers=_auth_header(uid))
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 684


@pytest.mark.asyncio
async def test_get_grid_feature_shape():
    uid = await _create_user("test_ranger_grid2")
    async with _client() as c:
        r = await c.get("/v1/risk/grid", headers=_auth_header(uid))
    feature = r.json()["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "Polygon"
    assert "cell_id" in feature["properties"]
    assert "row" in feature["properties"]
    assert "col" in feature["properties"]


@pytest.mark.asyncio
async def test_get_grid_with_no_grid_uploaded_returns_404(backup_grid_file):
    uid = await _create_user("test_ranger_grid3")
    async with _client() as c:
        r = await c.get("/v1/risk/grid", headers=_auth_header(uid))
    assert r.status_code == 404
    assert r.json()["detail"] == "No park grid has been uploaded yet"


@pytest.mark.asyncio
async def test_get_grid_without_token_returns_401():
    async with _client() as c:
        r = await c.get("/v1/risk/grid")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_risk_summary_returns_incident_and_sighting_counts():
    uid = await _create_user("test_ranger_summary")
    async with _client() as c:
        r = await c.get("/v1/risk/summary", headers=_auth_header(uid))
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["incidents_60d"], int)
    assert isinstance(body["sightings_7d"], int)
    assert body["incidents_60d"] >= 0
    assert body["sightings_7d"] >= 0


@pytest.mark.asyncio
async def test_get_risk_summary_without_token_returns_401():
    async with _client() as c:
        r = await c.get("/v1/risk/summary")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_geojson_file_upload(
    sample_geojson,
    backup_grid_file,
):
    uid = await _create_user("test_ranger_grid3", "admin")

    async with _rolled_back_connection() as conn, _client() as c:
        files = {
            "file": ("reserve.geojson", sample_geojson, "application/json"),
        }
        upload_res = await c.post(
            "/v1/risk/upload",
            files=files,
            headers=_auth_header(uid),
        )

        assert upload_res.status_code == 201
        assert backup_grid_file.is_file()

        entries = await _audit_entries(conn, uid)

    assert len(entries) == 1
    action, target_type, target_id, details = entries[0]
    assert (action, target_type, target_id) == (
        "park_grid.uploaded",
        "park_grid",
        settings.PARK_ID,
    )
    assert details["total_cells"] > 0


@pytest.mark.asyncio
async def test_upload_geojson_invalid_file_returns_400(backup_grid_file):
    uid = await _create_user("test_ranger_grid3", "admin")

    async with _client() as c:
        invalid_file = {
            "file": ("invalid.txt", b"not geojson content", "text/plain"),
        }
        upload_res = await c.post(
            "/v1/risk/upload",
            files=invalid_file,
            headers=_auth_header(uid),
        )

    assert upload_res.status_code == 400
    assert "Invalid file format" in upload_res.json()["detail"]
    assert not backup_grid_file.is_file()


async def _seed_park_risk_data(conn, trained_by: str) -> None:
    await conn.execute(
        text("""
            UPDATE risk_models SET is_active = FALSE
            WHERE park_id = :park_id AND is_active = TRUE
        """),
        {"park_id": settings.PARK_ID},
    )
    model_id = (
        await conn.execute(
            text("""
                INSERT INTO risk_models
                    (park_id, version, object_storage_key, is_active,
                     trained_by, training_window_start,
                     training_window_end, n_training_examples, metrics)
                VALUES
                    (:park_id,
                     COALESCE((SELECT MAX(version) FROM risk_models
                               WHERE park_id = :park_id), 0) + 1,
                     'risk-models/test/delete-grid.json', TRUE,
                     :trained_by, NOW() - INTERVAL '30 days',
                     NOW() - INTERVAL '1 day', 100, '{}')
                RETURNING id
            """),
            {"park_id": settings.PARK_ID, "trained_by": trained_by},
        )
    ).scalar_one()
    await conn.execute(
        text("""
            INSERT INTO risk_heatmaps
                (model_id, grid_resolution, time_interval)
            VALUES (:model_id, '1km', '6h')
        """),
        {"model_id": model_id},
    )
    await conn.execute(
        text("""
            INSERT INTO grid_cells
                (park_id, cell_ref, row_index, col_index, polygon_bounds)
            VALUES (:park_id, 'cell-delete-test', 0, 0,
                ST_GeogFromText('POLYGON((31.0 -24.0, 31.01 -24.0,
                31.01 -24.01, 31.0 -24.01, 31.0 -24.0))'))
            ON CONFLICT (park_id, cell_ref) DO NOTHING
        """),
        {"park_id": settings.PARK_ID},
    )


async def _count_park_rows(conn) -> dict[str, int]:
    counts = {}
    for name, sql in {
        "risk_models": "SELECT COUNT(*) FROM risk_models"
        " WHERE park_id = :park_id",
        "risk_heatmaps": "SELECT COUNT(*) FROM risk_heatmaps rh"
        " JOIN risk_models rm ON rm.id = rh.model_id"
        " WHERE rm.park_id = :park_id",
        "grid_cells": "SELECT COUNT(*) FROM grid_cells"
        " WHERE park_id = :park_id",
    }.items():
        counts[name] = (
            await conn.execute(text(sql), {"park_id": settings.PARK_ID})
        ).scalar_one()
    return counts


@pytest.mark.asyncio
async def test_delete_grid_removes_heatmaps_models_and_cells(
    sample_geojson,
    backup_grid_file,
):
    uid = await _create_user("test_admin_delete_grid", "admin")
    storage = MagicMock()

    async with (
        _rolled_back_connection() as conn,
        _client() as c,
    ):
        await _seed_park_risk_data(conn, uid)
        files = {
            "file": ("reserve.geojson", sample_geojson, "application/json"),
        }
        upload_res = await c.post(
            "/v1/risk/upload",
            files=files,
            headers=_auth_header(uid),
        )
        assert upload_res.status_code == 201

        with patch(
            "app.services.risk_service.RiskModelStorage",
            return_value=storage,
        ):
            delete_res = await c.delete(
                "/v1/risk/geojson",
                headers=_auth_header(uid),
            )

        assert delete_res.status_code == 200
        assert delete_res.json() == {"success": True}
        assert [entry[0] for entry in await _audit_entries(conn, uid)] == [
            "park_grid.uploaded",
            "park_grid.deleted",
        ]
        assert await _count_park_rows(conn) == {
            "risk_models": 0,
            "risk_heatmaps": 0,
            "grid_cells": 0,
        }

    deleted_keys = [c.args[0] for c in storage.delete_model.call_args_list]
    assert "risk-models/test/delete-grid.json" in deleted_keys
    assert not backup_grid_file.is_file()


@pytest.mark.asyncio
async def test_upload_when_grid_exists_returns_409(
    sample_geojson,
    backup_grid_file,
):
    uid = await _create_user("test_admin_upload_twice", "admin")

    async with _rolled_back_connection(), _client() as c:
        files = {
            "file": ("reserve.geojson", sample_geojson, "application/json"),
        }
        first = await c.post(
            "/v1/risk/upload",
            files=files,
            headers=_auth_header(uid),
        )
        second = await c.post(
            "/v1/risk/upload",
            files=files,
            headers=_auth_header(uid),
        )

    assert first.status_code == 201
    assert second.status_code == 409
    assert "Delete it before uploading" in second.json()["detail"]


@pytest.mark.asyncio
async def test_delete_grid_as_analyst_returns_403(backup_grid_file):
    uid = await _create_user("test_analyst_delete_grid", "analyst")

    async with _client() as c:
        res = await c.delete("/v1/risk/geojson", headers=_auth_header(uid))

    assert res.status_code == 403
