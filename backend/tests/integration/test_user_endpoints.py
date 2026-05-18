"""Integration tests for authenticated user profile endpoints."""

import asyncio
import os
import pytest

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
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
		"username": "test_profile_user",
		"email": "test_profile_user@example.com",
		"password": "SecurePass1!",
		"first_name": "Test",
		"last_name": "Profile",
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


async def _login_headers(client: AsyncClient) -> dict[str, str]:
	await client.post("/v1/auth/register", json=_register_payload())
	async with _engine.begin() as conn:
		await conn.execute(text("UPDATE users SET is_active = TRUE WHERE username = 'test_profile_user'"))

	response = await client.post(
		"/v1/auth/login",
		json={"username": "test_profile_user", "password": "SecurePass1!"},
	)
	token = response.json()["access_token"]
	return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_me_returns_profile():
	async with _client() as client:
		headers = await _login_headers(client)
		response = await client.get("/v1/users/me", headers=headers)

	assert response.status_code == 200
	data = response.json()
	assert data["username"] == "test_profile_user"
	assert data["email"] == "test_profile_user@example.com"
	assert data["first_name"] == "Test"
	assert data["last_name"] == "Profile"
	assert data["role"] == "ranger"
	assert data["is_active"] is True
	assert "created_at" in data


@pytest.mark.asyncio
async def test_patch_me_updates_names():
	async with _client() as client:
		headers = await _login_headers(client)
		response = await client.patch(
			"/v1/users/me",
			headers=headers,
			json={"first_name": "New", "last_name": "Name"},
		)

	assert response.status_code == 200
	data = response.json()
	assert data["first_name"] == "New"
	assert data["last_name"] == "Name"


@pytest.mark.asyncio
async def test_patch_me_rejects_empty_payload():
	async with _client() as client:
		headers = await _login_headers(client)
		response = await client.patch("/v1/users/me", headers=headers, json={})

	assert response.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_changes_password_and_revokes_old_login():
	async with _client() as client:
		headers = await _login_headers(client)
		response = await client.patch(
			"/v1/users/me",
			headers=headers,
			json={"current_password": "SecurePass1!", "new_password": "NewSecurePass2!"},
		)

		assert response.status_code == 200

		old_login = await client.post(
			"/v1/auth/login",
			json={"username": "test_profile_user", "password": "SecurePass1!"},
		)
		assert old_login.status_code == 401

		new_login = await client.post(
			"/v1/auth/login",
			json={"username": "test_profile_user", "password": "NewSecurePass2!"},
		)

	assert new_login.status_code == 200
