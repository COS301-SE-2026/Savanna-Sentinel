"""
Integration tests for the auth endpoints.

Uses httpx.AsyncClient with the FastAPI app in test mode.
Runs against a real PostgreSQL database configured via DATABASE_URL.
"""

from __future__ import annotations

import os
import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.security import get_password_hash
from app.main import app
from app.models.user import Base, User


DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.execute(text("DELETE FROM refresh_tokens"))
        await session.execute(text("DELETE FROM users"))
        await session.commit()


async def seed_user(session, username: str, password: str, is_active: bool = True) -> User:
    user = User(
        id=uuid.uuid4(),
        username=username,
        email=f"{username}@savana.test",
        password_hash=get_password_hash(password),
        first_name="Test",
        last_name="User",
        role="ranger",
        is_active=is_active,
    )
    session.add(user)
    await session.commit()
    return user

async def client_post(path: str, body: dict) -> tuple[int, dict]:
    """POST to the app and return (status_code, json_body)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(path, json=body)
    return response.status_code, response.json()


# Login endpoint

@pytest.mark.asyncio
async def test_login_success_returns_200_with_tokens(db_session):
    """valid active user → 200 with access_token, refresh_token, expires_in."""
    await seed_user(db_session, "ranger", "SecurePass1!", True)
    status, body = await client_post(
        "/v1/auth/login",
        {"username": "ranger", "password": "SecurePass1!"}
    )
    assert status == 200
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 3600


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(db_session):
    """US1.3: wrong password → 401, not 403, not 404."""
    await seed_user(db_session, "ranger", "SecurePass1!", True)
    status, body = await client_post(
        "/v1/auth/login",
        {"username": "ranger", "password": "WrongPassword"}
    )
    assert status == 401
    # Vague detail — must not say "password" or "username"
    assert "password" not in body.get("detail", "").lower()
    assert "username" not in body.get("detail", "").lower()


@pytest.mark.asyncio
async def test_login_unknown_username_returns_401():
    """US1.3: unknown username returns same 401 as wrong password (no enumeration)."""
    status, _ = await client_post(
        "/v1/auth/login",
        {"username": "ghost", "password": "AnyPass1!"}
    )
    assert status == 401


@pytest.mark.asyncio
async def test_login_inactive_account_returns_401(db_session):
    """US1.3: inactive account → same vague 401."""
    await seed_user(db_session, "inactive", "SecurePass1!", False)
    status, _ = await client_post(
        "/v1/auth/login",
        {"username": "inactive", "password": "SecurePass1!"}
    )
    assert status == 401


@pytest.mark.asyncio
async def test_login_missing_fields_returns_422():
    """Pydantic rejects malformed request bodies before they reach the service."""
    status, _ = await client_post("/v1/auth/login", {"username": "ranger"})
    assert status == 422


# Refresh endpoint

@pytest.mark.asyncio
async def test_refresh_valid_token_returns_200(db_session):
    """US1.4: valid refresh token → 200 with new tokens."""
    await seed_user(db_session, "ranger", "SecurePass1!", True)
    _, login_body = await client_post(
        "/v1/auth/login",
        {"username": "ranger", "password": "SecurePass1!"}
    )
    status, body = await client_post(
        "/v1/auth/refresh",
        {"refresh_token": login_body["refresh_token"]}
    )
    assert status == 200
    assert "access_token" in body


@pytest.mark.asyncio
async def test_refresh_invalid_token_returns_401():
    """US1.4: garbage refresh token → 401."""
    status, _ = await client_post(
        "/v1/auth/refresh",
        {"refresh_token": "garbage.token.value"}
    )
    assert status == 401


# Logout endpoint

@pytest.mark.asyncio
async def test_logout_returns_204(db_session):
    """Logout always returns 204 No Content."""
    await seed_user(db_session, "ranger", "SecurePass1!", True)
    _, login_body = await client_post(
        "/v1/auth/login",
        {"username": "ranger", "password": "SecurePass1!"}
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/logout",
            json={"refresh_token": login_body["refresh_token"]}
        )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_logout_then_refresh_returns_401(db_session):
    """After logout the refresh token must be rejected."""
    await seed_user(db_session, "ranger", "SecurePass1!", True)
    _, login_body = await client_post(
        "/v1/auth/login",
        {"username": "ranger", "password": "SecurePass1!"}
    )
    refresh_token = login_body["refresh_token"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/auth/logout", json={"refresh_token": refresh_token})

    status, _ = await client_post("/v1/auth/refresh", {"refresh_token": refresh_token})
    assert status == 401


# Health check

@pytest.mark.asyncio
async def test_health_endpoint_returns_200():
    """Basic liveness check."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}