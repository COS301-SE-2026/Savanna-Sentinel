import asyncio
import json
import shutil

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.repositories.risk_repository import (
    GRID_FILE_PATH,
    invalidate_grid_cache,
)

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

    invalidate_grid_cache()

    yield GRID_FILE_PATH

    if GRID_FILE_PATH.exists():
        GRID_FILE_PATH.unlink()

    if backup_path.exists():
        shutil.move(backup_path, GRID_FILE_PATH)

    invalidate_grid_cache()


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
async def test_geojson_file_upload(
    sample_geojson,
    backup_grid_file,
):
    uid = await _create_user("test_ranger_grid3", "admin")

    async with _client() as c:
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
