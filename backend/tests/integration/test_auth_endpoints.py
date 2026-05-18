"""
Integration tests for POST /v1/auth/register

Sends real HTTP requests to a running backend container.
All test users use the 'test_' prefix so the autouse fixture can clean them up.
BASE_URL defaults to http://localhost:8000 — override via env var in CI.
"""

import asyncio
import os
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

_BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://sentinel:sentinel_dev_password@localhost:5432/savanna_sentinel",
)

_engine = create_async_engine(_DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


def _client():
    return AsyncClient(base_url=_BASE_URL)


def _payload(**overrides):
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


# register

@pytest.mark.asyncio
async def test_register_returns_201():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_payload())
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "test_ranger"
    assert data["email"] == "test_ranger@example.com"
    assert data["role"] == "ranger"
    assert data["is_active"] is False
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_register_new_account_is_inactive():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_payload())
    assert r.json()["is_active"] is False

@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_payload())
        r = await c.post("/v1/auth/register", json=_payload(username="test_other"))
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_register_duplicate_username_returns_409():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_payload())
        r = await c.post("/v1/auth/register", json=_payload(email="test_other@example.com"))
    assert r.status_code == 409

@pytest.mark.asyncio
async def test_register_short_password_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_payload(password="short"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_payload(email="not-an-email"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_missing_field_returns_422():
    payload = _payload()
    del payload["username"]
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=payload)
    assert r.status_code == 422

@pytest.mark.asyncio
async def test_register_all_valid_roles_accepted():
    async with _client() as c:
        for role in ("ranger", "analyst", "community_liaison"):
            r = await c.post("/v1/auth/register", json=_payload(
                username=f"test_{role}",
                email=f"test_{role}@example.com",
                requested_role=role,
            ))
            assert r.status_code == 201, f"role={role} got {r.status_code}"

@pytest.mark.asyncio
async def test_register_admin_role_rejected_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_payload(requested_role="admin"))
    assert r.status_code == 422
