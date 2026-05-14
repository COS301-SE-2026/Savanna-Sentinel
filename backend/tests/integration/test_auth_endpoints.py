"""
Integration tests for the auth endpoints.

Uses httpx.AsyncClient with the FastAPI app in test mode.
No real database or network connection needed.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


# ── Helpers ───────────────────────────────────────────────────────────────────

async def client_post(path: str, body: dict) -> tuple[int, dict]:
    """POST to the app and return (status_code, json_body)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(path, json=body)
    return response.status_code, response.json()


# ── Login endpoint ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success_returns_200_with_tokens():
    """US1.3: valid active user → 200 with access_token, refresh_token, expires_in."""
    status, body = await client_post(
        "/v1/auth/login",
        {"email": "ranger@savana.test", "password": "SecurePass1!"}
    )
    assert status == 200
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 3600


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401():
    """US1.3: wrong password → 401, not 403, not 404."""
    status, body = await client_post(
        "/v1/auth/login",
        {"email": "ranger@savana.test", "password": "WrongPassword"}
    )
    assert status == 401
    # Vague detail — must not say "password" or "email"
    assert "password" not in body.get("detail", "").lower()
    assert "email" not in body.get("detail", "").lower()


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401():
    """US1.3: unknown email returns same 401 as wrong password (no enumeration)."""
    status, _ = await client_post(
        "/v1/auth/login",
        {"email": "ghost@nobody.test", "password": "AnyPass1!"}
    )
    assert status == 401


@pytest.mark.asyncio
async def test_login_inactive_account_returns_401():
    """US1.3: inactive account → same vague 401."""
    status, _ = await client_post(
        "/v1/auth/login",
        {"email": "inactive@savana.test", "password": "SecurePass1!"}
    )
    assert status == 401


@pytest.mark.asyncio
async def test_login_missing_fields_returns_422():
    """Pydantic rejects malformed request bodies before they reach the service."""
    status, _ = await client_post("/v1/auth/login", {"email": "not-an-email"})
    assert status == 422


# ── Refresh endpoint ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_valid_token_returns_200():
    """US1.4: valid refresh token → 200 with new tokens."""
    _, login_body = await client_post(
        "/v1/auth/login",
        {"email": "ranger@savana.test", "password": "SecurePass1!"}
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


# ── Logout endpoint ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_returns_204():
    """Logout always returns 204 No Content."""
    _, login_body = await client_post(
        "/v1/auth/login",
        {"email": "ranger@savana.test", "password": "SecurePass1!"}
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/logout",
            json={"refresh_token": login_body["refresh_token"]}
        )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_logout_then_refresh_returns_401():
    """After logout the refresh token must be rejected."""
    _, login_body = await client_post(
        "/v1/auth/login",
        {"email": "ranger@savana.test", "password": "SecurePass1!"}
    )
    refresh_token = login_body["refresh_token"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/v1/auth/logout", json={"refresh_token": refresh_token})

    status, _ = await client_post("/v1/auth/refresh", {"refresh_token": refresh_token})
    assert status == 401


# ── Health check ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint_returns_200():
    """Basic liveness check."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}