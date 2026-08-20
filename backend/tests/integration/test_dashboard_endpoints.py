"""Endpoint integration tests for GET /v1/dashboard.

Self-contained module-level engine/session, matching the pattern used by
test_report_endpoints.py: ASGITransport keeps requests in-process against a
single asyncpg-backed session, avoiding the cross-loop issues TestClient has
with an async session.
"""

import asyncio

import pytest
import pytest_asyncio
from httpx2 import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token
from app.main import app

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="https://test")


async def _create_user(username: str, role: str) -> str:
    async with _Session() as session:
        async with session.begin():
            result = await session.execute(
                text("""
                    INSERT INTO users
                        (email, username, first_name, last_name, password_hash,
                         role, is_active)
                    VALUES
                        (:email, :username, 'Test', 'User', 'dummy_hash', :role,
                         true)
                    ON CONFLICT (username) DO NOTHING
                    RETURNING id
                """),
                {
                    "email": f"{username}@savanna.test",
                    "username": username,
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


@pytest.fixture(autouse=True)
def cleanup():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_dashboard_%'"),
            )

    asyncio.run(_delete())


@pytest_asyncio.fixture
async def ranger_token() -> str:
    uid = await _create_user("test_dashboard_ranger", "ranger")
    return create_access_token(uid)


@pytest_asyncio.fixture
async def analyst_token() -> str:
    uid = await _create_user("test_dashboard_analyst", "analyst")
    return create_access_token(uid)


@pytest_asyncio.fixture
async def admin_token() -> str:
    uid = await _create_user("test_dashboard_admin", "admin")
    return create_access_token(uid)


@pytest.mark.asyncio
async def test_dashboard_requires_authentication():
    async with _client() as c:
        r = await c.get("/v1/dashboard")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_dashboard_rejects_ranger(ranger_token):
    async with _client() as c:
        r = await c.get(
            "/v1/dashboard",
            headers={"Authorization": f"Bearer {ranger_token}"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dashboard_allows_analyst(analyst_token):
    async with _client() as c:
        r = await c.get(
            "/v1/dashboard",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {
        "stats",
        "patrol_coverage",
        "report_trends",
        "model_performance",
        "recent_field_reports",
        "risk_zones",
    }


@pytest.mark.asyncio
async def test_dashboard_allows_admin(admin_token):
    async with _client() as c:
        r = await c.get(
            "/v1/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200
