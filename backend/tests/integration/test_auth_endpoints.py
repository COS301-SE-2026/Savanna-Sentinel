import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import get_password_hash
from app.main import app

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _register_payload(**overrides) -> dict:
    base = {
        "username": "test_ranger",
        "email": "test_ranger@example.com",
        "password": "SecurePass1!",
        "first_name": "Test",
        "last_name": "Ranger",
        "requested_role": "ranger",
    }
    return {**base, **overrides}


def _payload(**overrides) -> dict:
    return _register_payload(**overrides)

def _login_payload(**overrides) -> dict:
    """Default valid login payload. Override any field with kwargs."""
    base = {
        "username": "test_active",
        "password": "SecurePass1!",
    }
    return {**base, **overrides}

#Seed halper
async def _create_user(
    email: str,
    username: str,
    password: str,
    role: str = "ranger",
    is_active: bool = True,
) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("""
                INSERT INTO users
                    (email, username, first_name, last_name,
                     password_hash, role, is_active)
                VALUES
                    (:email, :username, :first_name, :last_name,
                     :password_hash, :role, :is_active)
                ON CONFLICT (email) DO NOTHING
            """),
            {
                "email": email,
                "username": username,
                "first_name": "Test",
                "last_name": "User",
                "password_hash": get_password_hash(password),
                "role": role,
                "is_active": is_active,
            },
        )

@pytest.fixture(autouse=True)
def cleanup_test_users():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            #Delete refresh tokens first foreign key constraint
            await conn.execute(
                text("""
                    DELETE FROM refresh_tokens
                    WHERE user_id IN (
                        SELECT id FROM users WHERE username LIKE 'test_%'
                    )
                """),
            )
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_%'"),
            )

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
        r = await c.post(
            "/v1/auth/register",
            json=_payload(username="test_other"))
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_register_duplicate_username_returns_409():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_payload())
        r = await c.post(
            "/v1/auth/register",
            json=_payload(email="test_other@example.com"))
    assert r.status_code == 409

@pytest.mark.asyncio
async def test_register_short_password_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/register", json=_payload(password="short"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email_returns_422():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/register",
            json=_payload(email="not-an-email"))
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
        r = await c.post(
            "/v1/auth/register",
            json=_payload(requested_role="admin"))
    assert r.status_code == 422

# POST /v1/auth/login

#Happy path

@pytest.mark.asyncio
async def test_login_returns_200():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post("/v1/auth/login", json=_login_payload())

    assert r.status_code == 200


@pytest.mark.asyncio
async def test_login_response_contains_access_token():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post("/v1/auth/login", json=_login_payload())

    body = r.json()
    assert "access_token" in body
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 0


@pytest.mark.asyncio
async def test_login_response_contains_refresh_token():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post("/v1/auth/login", json=_login_payload())

    body = r.json()
    assert "refresh_token" in body
    assert isinstance(body["refresh_token"], str)
    assert len(body["refresh_token"]) > 0


@pytest.mark.asyncio
async def test_login_response_token_type_is_bearer():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post("/v1/auth/login", json=_login_payload())

    assert r.json()["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_response_expires_in_is_3600():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post("/v1/auth/login", json=_login_payload())

    assert r.json()["expires_in"] == 3600


@pytest.mark.asyncio
async def test_login_access_token_is_valid_jwt_structure():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post("/v1/auth/login", json=_login_payload())

    token = r.json()["access_token"]
    parts = token.split(".")
    assert len(parts) == 3, (
        f"Expected JWT with 3 parts (header.payload.signature), got: {token!r}"
    )

#Wrong password

@pytest.mark.asyncio
async def test_login_wrong_password_returns_401():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json=_login_payload(password="WrongPassword999!"),
        )

    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_password_detail_is_vague():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json=_login_payload(password="WrongPassword999!"),
        )

    detail = r.json().get("detail", "").lower()
    assert "password" not in detail, (
        f"Error detail reveals which field failed: {detail!r}"
    )
    assert "test_active@savana.test" not in detail, (
        f"Error detail reveals the email address: {detail!r}"
    )

 # Unknown email (enumeration prevention)

@pytest.mark.asyncio
async def test_login_unknown_email_returns_401():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json=_login_payload(email="test_ghost_nobody@nowhere.test"),
        )

    assert r.status_code == 401

@pytest.mark.asyncio
async def test_login_unknown_email_and_wrong_password_return_identical_detail():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        wrong_pw = await c.post(
            "/v1/auth/login",
            json=_login_payload(password="WrongPassword999!"),
        )
        unknown_email = await c.post(
            "/v1/auth/login",
                json=_login_payload(username="test_ghost"),
        )

    assert wrong_pw.json().get("detail") == unknown_email.json().get("detail")
    (
        "Different error messages for wrong password vs unknown email allow "
        "email enumeration - both must return identical detail text."
    )

#Inactive account

@pytest.mark.asyncio
async def test_login_inactive_account_returns_401():
    await _create_user(
        email="test_inactive@savana.test",
        username="test_inactive",
        password="SecurePass1!",
        is_active=False,
    )
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json=_login_payload(email="test_inactive@savana.test"),
        )

    assert r.status_code == 401

@pytest.mark.asyncio
async def test_login_inactive_and_wrong_password_return_identical_detail():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    await _create_user(
        email="test_inactive@savana.test",
        username="test_inactive",
        password="SecurePass1!",
        is_active=False,
    )
    async with _client() as c:
        wrong_pw = await c.post(
            "/v1/auth/login",
            json=_login_payload(password="WrongPassword999!"),
        )
        inactive = await c.post(
            "/v1/auth/login",
                json=_login_payload(username="test_inactive"),
        )

    assert wrong_pw.json().get("detail") == inactive.json().get("detail"), (
        "Different error for inactive account vs wrong password reveals "
        "account status - both must return identical detail text."
    )

#Newly registered account cannot log in

@pytest.mark.asyncio
async def test_login_newly_registered_account_is_blocked():
    async with _client() as c:
        await c.post("/v1/auth/register", json=_register_payload())
        r = await c.post(
            "/v1/auth/login",
            json=_login_payload(
                email="test_ranger@example.com",
                password="SecurePass1!",
            ),
        )

    assert r.status_code == 401

#Malformed requests (Pydantic validation)

@pytest.mark.asyncio
async def test_login_missing_email_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/login", json={"password": "SecurePass1!"})

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_missing_password_returns_422():
    """Pydantic must reject a missing password field with 422."""
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json={"email": "test_active@savana.test"},
        )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_invalid_email_format_returns_422():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json={"email": "this-is-not-an-email", "password": "SecurePass1!"},
        )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_empty_body_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/login", json={})

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_empty_password_returns_422():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json={"email": "test_active@savana.test", "password": ""},
        )

    assert r.status_code == 422

#Security

@pytest.mark.asyncio
async def test_login_401_includes_www_authenticate_header():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json=_login_payload(email="test_nobody@nowhere.test"),
        )

    assert r.status_code == 401
    assert "www-authenticate" in r.headers
    assert "bearer" in r.headers["www-authenticate"].lower()

@pytest.mark.asyncio
async def test_login_never_returns_500():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json={"email": "any@valid-format.com", "password": "anypassword"},
        )

    assert r.status_code != 500

#POST /v1/auth/refresh

@pytest.mark.asyncio
async def test_refresh_valid_token_returns_200():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        r = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": login.json()["refresh_token"]},
        )

    assert r.status_code == 200


@pytest.mark.asyncio
async def test_refresh_returns_new_access_token():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        r = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": login.json()["refresh_token"]},
        )

    body = r.json()
    assert "access_token" in body
    assert len(body["access_token"]) > 0


@pytest.mark.asyncio
async def test_refresh_rotates_refresh_token():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        old_refresh = login.json()["refresh_token"]
        r = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )

    assert r.json()["refresh_token"] != old_refresh


@pytest.mark.asyncio
async def test_refresh_old_token_rejected_after_rotation():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        old_refresh = login.json()["refresh_token"]

        first = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert first.status_code == 200

        second = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )

    assert second.status_code == 401


@pytest.mark.asyncio
async def test_refresh_garbage_token_returns_401():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": "this.is.complete.garbage"},
        )

    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_access_token_used_as_refresh_returns_401():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        r = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": login.json()["access_token"]},
        )

    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_missing_field_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/refresh", json={})

    assert r.status_code == 422

# POST /v1/auth/logout

@pytest.mark.asyncio
async def test_logout_returns_204():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        r = await c.post(
            "/v1/auth/logout",
            json={"refresh_token": login.json()["refresh_token"]},
        )

    assert r.status_code == 204


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        refresh_token = login.json()["refresh_token"]

        await c.post(
            "/v1/auth/logout",
            json={"refresh_token": refresh_token},
        )

        r = await c.post(
            "/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

    assert r.status_code == 401


@pytest.mark.asyncio
async def test_logout_twice_is_silent_204():
    await _create_user(
        email="test_active@savana.test",
        username="test_active",
        password="SecurePass1!",
        is_active=True,
    )
    async with _client() as c:
        login = await c.post("/v1/auth/login", json=_login_payload())
        token = login.json()["refresh_token"]

        first = await c.post("/v1/auth/logout", json={"refresh_token": token})
        second = await c.post("/v1/auth/logout", json={"refresh_token": token})

    assert first.status_code == 204
    assert second.status_code == 204


@pytest.mark.asyncio
async def test_logout_garbage_token_returns_204():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/logout",
            json={"refresh_token": "garbage.token.string"},
        )

    assert r.status_code == 204


@pytest.mark.asyncio
async def test_logout_malformed_token_returns_204():
    async with _client() as c:
        r = await c.post(
            "/v1/auth/logout",
            json={"refresh_token": "not-a-jwt"},
        )

    assert r.status_code == 204

@pytest.mark.asyncio
async def test_logout_missing_field_returns_422():
    async with _client() as c:
        r = await c.post("/v1/auth/logout", json={})

    assert r.status_code == 422
