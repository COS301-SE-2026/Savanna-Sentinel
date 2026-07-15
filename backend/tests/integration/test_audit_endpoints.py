import asyncio
import os

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

_BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # sonar:disable:S2068
    "postgresql+asyncpg://sentinel:sentinel_dev_password@localhost:5432/savanna_sentinel",
)

_engine = create_async_engine(_DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


def _client():
    return AsyncClient(base_url=_BASE_URL)


def _register_payload(**overrides):
    base = {
        "username": "test_audit_user",
        "email": "test_audit_user@example.com",
        "password": "SecurePass1!",
        "first_name": "Test",
        "last_name": "Audit",
        "requested_role": "ranger",
    }
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def cleanup_test_users():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(text(
            "DELETE "
            "FROM users "
            "WHERE username LIKE 'test_%'",
            ))

    asyncio.run(_delete())


async def _promote_and_activate(username: str, role: str = "admin") -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text(
                 "UPDATE users " \
                 "SET role = :role, is_active = true " \
                 "WHERE username = :username",
                 ),
            {"role": role, "username": username},
        )


async def _activate(username: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("UPDATE users " \
            "SET is_active = true " \
            "WHERE username = :username",
            ),
            {"username": username},
        )


async def _login(username: str, password: str) -> str:
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json={
                "username": username,
                "password": password,
                },
            )
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest_asyncio.fixture
async def admin_token():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload(
            username="test_audit_admin",
            email="test_audit_admin@example.com",
            requested_role="ranger",
        ))
    await _promote_and_activate("test_audit_admin", role="admin")
    return await _login("test_audit_admin", "SecurePass1!")


@pytest_asyncio.fixture
async def ranger_token():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload(
            username="test_audit_ranger",
            email="test_audit_ranger@example.com",
            requested_role="ranger",
        ))
    await _activate("test_audit_ranger")
    return await _login("test_audit_ranger", "SecurePass1!")


@pytest.mark.asyncio
async def test_list_audit_logs_requires_authentication():
    async with _client() as c:
        r = await c.get("/v1/audit-logs")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_audit_logs_rejects_non_admin(ranger_token):
    async with _client() as c:
        r = await c.get(
            "/v1/audit-logs",
            headers={"Authorization": f"Bearer {ranger_token}"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_list_audit_logs_allows_admin(admin_token):
    async with _client() as c:
        r = await c.get(
            "/v1/audit-logs",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200
