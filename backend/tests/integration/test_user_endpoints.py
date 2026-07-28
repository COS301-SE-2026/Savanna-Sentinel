import asyncio
import os

import pytest
import pytest_asyncio
from httpx2 import AsyncClient
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
        "username": "test_profile_user",
        "email": "test_profile_user@example.com",
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
            await conn.execute(text(
            "DELETE "
            "FROM users "
            "WHERE username LIKE 'test_%'",
            ))

    asyncio.run(_delete())



"""Integration tests for authenticated user profile endpoints."""

async def _login_headers(client: AsyncClient) -> dict[str, str]:
    await client.post("/v1/auth/register", json=_register_payload())
    async with _engine.begin() as conn:
        await conn.execute(text(
            "UPDATE users "
            "SET is_active = TRUE "
            "WHERE username = 'test_profile_user'",
            ))

    response = await client.post(
        "/v1/auth/login",
        json={"username": "test_profile_user", "password": "SecurePass1!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}



"""Integration tests for GET/PATCH /v1/users/me"""

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
    assert data["last_name"] == "Ranger"
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
async def test_patch_me_accepts_empty_string_and_updates():
    async with _client() as client:
        headers = await _login_headers(client)
        r = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"first_name": "", "last_name": ""},
        )

        assert r.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_rejects_null_fields_as_noop():
    async with _client() as client:
        headers = await _login_headers(client)
        r = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"first_name": None},
        )

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_rejects_whitespace_only_values():
    async with _client() as client:
        headers = await _login_headers(client)
        r = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"first_name": "   ", "last_name": "  L  "},
        )

        assert r.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_accepts_internal_space_in_first_name():
    async with _client() as client:
        headers = await _login_headers(client)
        r = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"first_name": "Mary Ann"},
        )

        assert r.status_code == 200
        get = await client.get("/v1/users/me", headers=headers)

    assert get.status_code == 200
    d = get.json()
    assert d["first_name"] == "Mary Ann"


@pytest.mark.asyncio
async def test_patch_me_requires_authentication():
    async with _client() as client:
        r = await client.patch(
            "/v1/users/me",
            json={"first_name": "NoAuth"},
        )

    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_patch_me_updates_first_name_only():
    async with _client() as client:
        headers = await _login_headers(client)
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"first_name": "SoloFirst"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["first_name"] == "SoloFirst"


@pytest.mark.asyncio
async def test_patch_me_updates_last_name_only():
    async with _client() as client:
        headers = await _login_headers(client)
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"last_name": "SoloLast"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["last_name"] == "SoloLast"


@pytest.mark.asyncio
async def test_patch_me_updates_names_and_password_together():
    async with _client() as client:
        headers = await _login_headers(client)
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={
                "first_name": "NewBoth",
                "last_name": "Names",
                "current_password": "SecurePass1!",
                "new_password": "CombinedNew1!",
            },
        )

        assert response.status_code == 200

        # old password should be rejected
        old_login = await client.post(
            "/v1/auth/login",
            json={"username": "test_profile_user", "password": "SecurePass1!"},
        )
        assert old_login.status_code == 401

        # new password should work
        new_login = await client.post(
            "/v1/auth/login",
            json={"username": "test_profile_user", "password": "CombinedNew1!"},
        )

    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_patch_me_rejects_password_without_current():
    async with _client() as client:
        headers = await _login_headers(client)
        # new password present but current missing
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"new_password": "SomeNewPass1!"},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_rejects_password_without_new():
    async with _client() as client:
        headers = await _login_headers(client)
        # current provided but new missing
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"current_password": "SecurePass1!"},
        )

    # service will not perform a password change if new_password is None, and
    # since no other fields were provided
    # this should be treated as empty payload
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_rejects_new_password_too_short():
    async with _client() as client:
        headers = await _login_headers(client)
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={"current_password": "SecurePass1!", "new_password": "short"},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_patch_me_rejects_incorrect_current_password():
    async with _client() as client:
        headers = await _login_headers(client)
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={
                 "current_password": "WrongPass!",
                "new_password": "ValidNewPass1!",
                },
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patch_me_changes_password_and_revokes_old_login():
    async with _client() as client:
        headers = await _login_headers(client)
        response = await client.patch(
            "/v1/users/me",
            headers=headers,
            json={
                 "current_password": "SecurePass1!",
                "new_password": "NewSecurePass2!",
                },
        )

        assert response.status_code == 200

        old_login = await client.post(
            "/v1/auth/login",
            json={"username": "test_profile_user", "password": "SecurePass1!"},
        )
        assert old_login.status_code == 401

        new_login = await client.post(
            "/v1/auth/login",
            json={
                 "username": "test_profile_user",
                "password": "NewSecurePass2!",
                },
        )

    assert new_login.status_code == 200



"""Integration tests for PATCH /v1/users/{user_id}/role."""

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


@pytest.mark.asyncio
async def test_change_role_to_admin_rejected_422(admin_token, target_user_id):
    async with _client() as c:
        r = await c.patch(
            f"/v1/users/{target_user_id}/role",
            json={"new_role": "admin"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_change_role_user_not_found_404(admin_token):
    async with _client() as c:
        r = await c.patch(
            "/v1/users/00000000-0000-0000-0000-000000000000/role",
            json={"new_role": "analyst"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_change_role_non_admin_forbidden(ranger_token, target_user_id):
    async with _client() as c:
        r = await c.patch(
            f"/v1/users/{target_user_id}/role",
            json={"new_role": "analyst"},
            headers={"Authorization": f"Bearer {ranger_token}"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_change_role_no_token_returns_403():
    async with _client() as c:
        r = await c.patch(
            "/v1/users/00000000-0000-0000-0000-000000000000/role",
            json={"new_role": "analyst"},
        )
    assert r.status_code in (401, 403)

# Soft-delete tests

@pytest_asyncio.fixture
async def active_target_user_id():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_register_payload(
            username="test_soft_target",
            email="test_soft_target@example.com",
            requested_role="ranger",
        ))
    await _activate("test_soft_target")
    return r.json()["id"]


@pytest.mark.asyncio
async def test_soft_delete_requires_authentication():
    async with _client() as c:
        r = await c.delete(
            "/v1/users/00000000-0000-0000-0000-000000000000",
        )
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_soft_delete_non_admin_forbidden(
    ranger_token, active_target_user_id,
):
    async with _client() as c:
        r = await c.delete(
            f"/v1/users/{active_target_user_id}",
            headers={"Authorization": f"Bearer {ranger_token}"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_soft_delete_active_account_success(
    admin_token, active_target_user_id,
):
    async with _client() as c:
        r = await c.delete(
            f"/v1/users/{active_target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200
    assert r.json()["id"] == active_target_user_id

    async with _engine.begin() as conn:
        row = await conn.execute(
            text("SELECT is_active, deleted_at FROM users WHERE id = :id"),
            {"id": active_target_user_id},
        )
        is_active, deleted_at = row.one()
    assert is_active is False
    assert deleted_at is not None


@pytest.mark.asyncio
async def test_soft_delete_pending_account_returns_404(
    admin_token, target_user_id,
):
    # target_user_id fixture registers but never activates - still pending
    async with _client() as c:
        r = await c.delete(
            f"/v1/users/{target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_soft_delete_nonexistent_user_returns_404(admin_token):
    async with _client() as c:
        r = await c.delete(
            "/v1/users/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_soft_delete_creates_audit_entry(
    admin_token, active_target_user_id,
):
    async with _client() as c:
        await c.delete(
            f"/v1/users/{active_target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        r = await c.get(
            f"/v1/audit-logs?action=user.soft_deleted&target_id={active_target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    body = r.json()
    assert len(body["results"]) == 1
    assert body["results"][0]["target_id"] == active_target_user_id
    assert body["results"][0]["target_type"] == "user"

@pytest.mark.asyncio
async def test_soft_deleted_account_absent_from_both_listings(
    admin_token, active_target_user_id,
):
    async with _client() as c:
        await c.delete(
            f"/v1/users/{active_target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        active = await c.get(
            "/v1/users", params={"is_active": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        pending = await c.get(
            "/v1/users", params={"is_active": False},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    active_ids = [u["id"] for u in active.json()["results"]]
    pending_ids = [u["id"] for u in pending.json()["results"]]
    assert active_target_user_id not in active_ids
    assert active_target_user_id not in pending_ids

@pytest.mark.asyncio
async def test_hard_delete_rejects_active_account(
    admin_token, active_target_user_id,
):
    async with _client() as c:
        r = await c.delete(
            f"/v1/admin/users/delete/{active_target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 404

@pytest.mark.asyncio
async def test_status_switch_rejects_soft_deleted_account(
    admin_token, active_target_user_id,
):
    async with _client() as c:
        await c.delete(
            f"/v1/users/{active_target_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        r = await c.patch(
            f"/v1/users/{active_target_user_id}/status",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 404
