import pytest
from httpx2 import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
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
                    INSERT INTO users (
                        email, username, first_name, last_name,
                        password_hash, role, is_active
                    )
                    VALUES (
                        :email, :username, 'Test', 'User',
                        :pw_hash, :role, TRUE
                    )
                    ON CONFLICT (username)
                    DO UPDATE SET username = EXCLUDED.username
                    RETURNING id
                """),
                {
                    "email": f"{username}@savanna.test", "username": username,
                    "pw_hash": get_password_hash("SecurePass1!"), "role": role,
                },
            )
            return str(result.fetchone()[0])


@pytest.mark.asyncio
async def test_train_requires_analyst_or_admin_role():
    ranger_id = await _create_user("risk_ranger", "ranger")
    token = create_access_token(ranger_id)

    async with _client() as client:
        response = await client.post(
            "/v1/risk/train",
            json={
                "window_start": "2026-01-01T00:00:00Z",
                "window_end": "2026-02-01T00:00:00Z",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_train_returns_202_with_job_id_for_analyst():
    analyst_id = await _create_user("risk_analyst_train", "analyst")
    token = create_access_token(analyst_id)

    async with _client() as client:
        response = await client.post(
            "/v1/risk/train",
            json={
                "window_start": "2026-01-01T00:00:00Z",
                "window_end": "2026-02-01T00:00:00Z",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert "job_id" in body


@pytest.mark.asyncio
async def test_train_rejects_invalid_window():
    analyst_id = await _create_user("risk_analyst_train2", "analyst")
    token = create_access_token(analyst_id)

    async with _client() as client:
        response = await client.post(
            "/v1/risk/train",
            json={
                "window_start": "2026-02-01T00:00:00Z",
                "window_end": "2026-01-01T00:00:00Z",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_train_job_status_for_unknown_job_is_queued_shaped():
    analyst_id = await _create_user("risk_analyst_train3", "analyst")
    token = create_access_token(analyst_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/train/nonexistent-job-id",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "nonexistent-job-id"


@pytest.mark.asyncio
async def test_score_requires_analyst_or_admin_role():
    ranger_id = await _create_user("risk_ranger2", "ranger")
    token = create_access_token(ranger_id)

    async with _client() as client:
        response = await client.post(
            "/v1/risk/score",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_score_returns_202_with_job_id_for_admin():
    admin_id = await _create_user("risk_admin_score", "admin")
    token = create_access_token(admin_id)

    async with _client() as client:
        response = await client.post(
            "/v1/risk/score",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 202
    assert "job_id" in response.json()
