import asyncio

import pytest
from sqlalchemy import text

from app.core.security import create_access_token, get_password_hash


async def _create_user(db_session, username: str, role: str) -> str:
    result = await db_session.execute(
        text("""
            INSERT INTO users
                (email, username, first_name, last_name, password_hash,
             role, is_active)
            VALUES
                (:email, :username, 'Test', 'User', :pw_hash, :role,
                TRUE)
            ON CONFLICT (username) DO NOTHING
            RETURNING id
        """),
        {
            "email": f"{username}@savanna.test",
            "username": username,
            "pw_hash": get_password_hash("SecurePass1!"),
            "role": role,
        },
    )
    row = result.fetchone()
    if row:
        await db_session.commit()
        return str(row[0])
    r2 = await db_session.execute(
        text("SELECT id FROM users WHERE username = :u"),
        {"u": username},
    )
    return str(r2.fetchone()[0])


def _auth_header(user_id: str) -> dict:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def cleanup(engine):
    yield

    async def _delete():
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "DELETE FROM refresh_tokens WHERE user_id IN "
                    "(SELECT id FROM users WHERE username LIKE 'test_%')",
                ),
            )
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_%'"),
            )

    asyncio.run(_delete())


def _payload(**overrides) -> dict:
    body = {"file_name": "snare.jpg", "content_type": "image/jpeg"}
    body.update(overrides)
    return body


# POST /v1/media/upload-url


@pytest.mark.asyncio
async def test_ranger_gets_upload_url_returns_200(client, db_session):
    uid = await _create_user(db_session, "test_ranger_sc10a", "ranger")
    r = await client.post(
        "/v1/media/upload-url",
        json=_payload(),
        headers=_auth_header(uid),
    )
    assert r.status_code == 200
    body = r.json()
    assert "upload_url" in body
    assert "object_url" in body
    assert body["expires_in"] == 300


@pytest.mark.asyncio
async def test_community_liaison_gets_upload_url_returns_200(
    client,
    db_session,
):
    uid = await _create_user(
        db_session,
        "test_liaison_sc10",
        "community_liaison",
    )
    r = await client.post(
        "/v1/media/upload-url",
        json=_payload(),
        headers=_auth_header(uid),
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_gets_upload_url_returns_200(client, db_session):
    uid = await _create_user(db_session, "test_admin_sc10", "admin")
    r = await client.post(
        "/v1/media/upload-url",
        json=_payload(),
        headers=_auth_header(uid),
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_analyst_blocked_returns_403(client, db_session):
    uid = await _create_user(db_session, "test_analyst_sc10", "analyst")
    r = await client.post(
        "/v1/media/upload-url",
        json=_payload(),
        headers=_auth_header(uid),
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_no_token_returns_401(client):
    r = await client.post("/v1/media/upload-url", json=_payload())
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_invalid_content_type_returns_400(client, db_session):
    uid = await _create_user(db_session, "test_ranger_sc10b", "ranger")
    r = await client.post(
        "/v1/media/upload-url",
        json=_payload(content_type="application/exe"),
        headers=_auth_header(uid),
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_empty_file_name_returns_422(client, db_session):
    uid = await _create_user(db_session, "test_ranger_sc10c", "ranger")
    r = await client.post(
        "/v1/media/upload-url",
        json=_payload(file_name=""),
        headers=_auth_header(uid),
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_object_url_is_reusable_across_requests(client, db_session):
    uid = await _create_user(db_session, "test_ranger_sc10d", "ranger")
    r1 = await client.post(
        "/v1/media/upload-url",
        json=_payload(),
        headers=_auth_header(uid),
    )
    r2 = await client.post(
        "/v1/media/upload-url",
        json=_payload(),
        headers=_auth_header(uid),
    )
    assert r1.json()["object_url"] != r2.json()["object_url"]
