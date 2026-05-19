"""
Integration tests for PATCH /v1/users/{user_id}/role.
"""

import asyncio
import os

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

_BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://sentinel:sentinel_dev_password@localhost:5432/savanna_sentinel",
)

_engine = create_async_engine(_DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


def _client():
    return AsyncClient(base_url=_BASE_URL)


def _register_payload(**overrides):
    base = {
        "username": "test_ranger",
        "email": "test_ranger@example.com",
        "password": "SecurePass1!",
        "first_name": "Test",
        "last_name": "Ranger",
        "requested_role": "ranger",
    }
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def cleanup_test_users():
    yield
    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE username LIKE 'test_%'"))
    asyncio.run(_delete())


async def _promote_and_activate(username: str, role: str = "admin") -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET role = :role, is_active = true WHERE username = :username"),
            {"role": role, "username": username},
        )


async def _activate(username: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET is_active = true WHERE username = :username"),
            {"username": username},
        )


async def _login(username: str, password: str) -> str:
    async with _client() as c:
        r = await c.post("/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


#Fixtures

@pytest_asyncio.fixture
async def admin_token():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload(
            username="test_admin",
            email="test_admin@example.com",
            requested_role="ranger",
        ))
    await _promote_and_activate("test_admin", role="admin")
    return await _login("test_admin", "SecurePass1!")


@pytest_asyncio.fixture
async def ranger_token():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload(
            username="test_ranger_active",
            email="test_ranger_active@example.com",
            requested_role="ranger",
        ))
    await _activate("test_ranger_active")
    return await _login("test_ranger_active", "SecurePass1!")


@pytest_asyncio.fixture
async def target_user_id():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_register_payload(
            username="test_target",
            email="test_target@example.com",
            requested_role="ranger",
        ))
    return r.json()["id"]

# Role swop tests

@pytest.mark.asyncio
async def test_change_role_success(admin_token, target_user_id):
    async with _client() as c:
        r = await c.patch(
            f"/v1/users/{target_user_id}/role",
            json={"new_role": "analyst"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200
    assert r.json()["role"] == "analyst"
    assert r.json()["id"] == target_user_id


@pytest.mark.asyncio
async def test_change_role_to_all_valid_roles(admin_token, target_user_id):
    async with _client() as c:
        for role in ("analyst", "community_liaison", "ranger"):
            r = await c.patch(
                f"/v1/users/{target_user_id}/role",
                json={"new_role": role},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert r.status_code == 200, f"role={role} got {r.status_code}"
            assert r.json()["role"] == role