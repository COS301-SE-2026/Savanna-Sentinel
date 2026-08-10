import asyncio
import os

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text

_BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


def _client():
    return AsyncClient(base_url=_BASE_URL)


def _register_payload(**overrides):
    base = {
        "username": "test_audit_user",
        "email": "test_audit_user@example.com",
        "password": "SecurePass1!",  # NOSONAR
        "first_name": "Test",
        "last_name": "Audit",
        "requested_role": "ranger",
    }
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def cleanup_test_users(engine):
    yield

    async def _delete():
        async with engine.begin() as conn:
            await conn.execute(text(
            "DELETE "
            "FROM users "
            "WHERE username LIKE 'test_%'",
            ))

    asyncio.run(_delete())


async def _promote_and_activate(
    engine, username: str, role: str = "admin",
) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                 "UPDATE users " \
                 "SET role = :role, is_active = true " \
                 "WHERE username = :username",
                 ),
            {"role": role, "username": username},
        )


async def _activate(engine, username: str) -> None:
    async with engine.begin() as conn:
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
async def admin_token(engine):
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload(
            username="test_audit_admin",
            email="test_audit_admin@example.com",
            requested_role="ranger",
        ))
    await _promote_and_activate(engine, "test_audit_admin", role="admin")
    return await _login("test_audit_admin", "SecurePass1!")


@pytest_asyncio.fixture
async def ranger_token(engine):
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload(
            username="test_audit_ranger",
            email="test_audit_ranger@example.com",
            requested_role="ranger",
        ))
    await _activate(engine, "test_audit_ranger")
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


@pytest_asyncio.fixture
async def seeded_audit_logs(admin_token, engine):
    async with engine.begin() as conn:
        result = await conn.execute(
            text("SELECT id FROM users WHERE username = :username"),
            {"username": "test_audit_admin"},
        )
        actor_id = str(result.scalar_one())

        actions = ("user.role_changed", "user.account_accepted", "user.deleted")
        for action in actions:
            await conn.execute(
                text(
                    "INSERT INTO audit_logs "
                    "(actor_id, action, target_type, target_id) "
                    "VALUES (:actor_id, :action, 'user', :actor_id)",
                ),
                {"actor_id": actor_id, "action": action},
            )

    return {"token": admin_token, "actor_id": actor_id}


@pytest.mark.asyncio
async def test_list_audit_logs_returns_expected_shape(seeded_audit_logs):
    async with _client() as c:
        response = await c.get(
            "/v1/audit-logs?page=1&page_size=2",
            headers={"Authorization": f"Bearer {seeded_audit_logs['token']}"},
        )

    body = response.json()
    assert set(body.keys()) == {"total", "page", "page_size", "results"}
    assert len(body["results"]) <= 2
    assert body["results"][0]["created_at"] is not None


@pytest.mark.asyncio
async def test_filter_by_action(seeded_audit_logs):
    async with _client() as c:
        response = await c.get(
            "/v1/audit-logs?action=user.deleted",
            headers={"Authorization": f"Bearer {seeded_audit_logs['token']}"},
        )

    body = response.json()
    actor_id = seeded_audit_logs["actor_id"]
    assert all(r["action"] == "user.deleted" for r in body["results"])
    assert any(r["actor_id"] == actor_id for r in body["results"])


@pytest.mark.asyncio
async def test_filter_by_actor_id(seeded_audit_logs):
    actor_id = seeded_audit_logs["actor_id"]

    async with _client() as c:
        response = await c.get(
            f"/v1/audit-logs?actor_id={actor_id}",
            headers={"Authorization": f"Bearer {seeded_audit_logs['token']}"},
        )

    body = response.json()
    assert all(r["actor_id"] == actor_id for r in body["results"])
    assert len(body["results"]) == 3


@pytest.mark.asyncio
async def test_audit_log_includes_actor_username(seeded_audit_logs):
    actor_id = seeded_audit_logs["actor_id"]

    async with _client() as c:
        response = await c.get(
            f"/v1/audit-logs?actor_id={actor_id}",
            headers={"Authorization": f"Bearer {seeded_audit_logs['token']}"},
        )

    body = response.json()
    assert len(body["results"]) == 3
    assert all(
        r["actor_username"] == "test_audit_admin" for r in body["results"]
    )
