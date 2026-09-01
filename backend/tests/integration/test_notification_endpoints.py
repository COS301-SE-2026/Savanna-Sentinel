import asyncio

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
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    )


async def _create_user(
    username: str,
    role: str = "ranger",
    is_active: bool = True,
) -> str:
    async with _Session() as session:
        async with session.begin():
            result = await session.execute(
                text("""
                    INSERT INTO users
                        (email, username, first_name, last_name, password_hash,
                         role, is_active)
                    VALUES
                        (:email, :username, 'Test', 'User', :pw_hash, :role,
                         :is_active)
                    ON CONFLICT (username) DO NOTHING
                    RETURNING id
                """),
                {
                    "email": f"{username}@savanna.test",
                    "username": username,
                    "pw_hash": get_password_hash("SecurePass1!"),
                    "role": role,
                    "is_active": is_active,
                },
            )
            row = result.fetchone()
            if row:
                return str(row[0])
            r2 = await session.execute(
                text("SELECT id FROM users WHERE username = :u"),
                {"u": username},
            )
            return str(r2.fetchone()[0])


async def _create_notification(
    user_id: str,
    *,
    type: str = "tipoff_submitted",
    title: str = "New incident tip-off",
    body: str = "A community member reported an incident.",
    read: bool = False,
) -> str:
    async with _engine.begin() as conn:
        row = await conn.execute(
            text("""
                INSERT INTO notifications
                    (user_id, type, title, body, read_at)
                VALUES
                    (:uid, CAST(:type AS notification_type), :title, :body,
                     CASE WHEN :read THEN NOW() ELSE NULL END)
                RETURNING id
            """),
            {
                "uid": user_id,
                "type": type,
                "title": title,
                "body": body,
                "read": read,
            },
        )
        return str(row.fetchone()[0])


@pytest.fixture(autouse=True)
def cleanup():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(
                text("""
                    DELETE FROM notifications
                    WHERE user_id IN (
                        SELECT id FROM users WHERE username LIKE 'test_%'
                    )
                """),
            )
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


def _auth_header(user_id: str) -> dict:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_notifications_returns_only_own_notifications():
    owner_id = await _create_user("test_notif_owner_1")
    other_id = await _create_user("test_notif_other_1")

    own_id = await _create_notification(owner_id, title="Mine")
    await _create_notification(other_id, title="Not mine")

    async with _client() as client:
        response = await client.get(
            "/v1/notifications",
            headers=_auth_header(owner_id),
        )

    assert response.status_code == 200
    body = response.json()
    ids = [item["id"] for item in body["results"]]
    assert own_id in ids
    assert len(ids) == 1


@pytest.mark.asyncio
async def test_list_notifications_reports_unread_count():
    owner_id = await _create_user("test_notif_unread_1")
    await _create_notification(owner_id, read=False)
    await _create_notification(owner_id, read=True)

    async with _client() as client:
        response = await client.get(
            "/v1/notifications",
            headers=_auth_header(owner_id),
        )

    body = response.json()
    assert body["total"] == 2
    assert body["unread_count"] == 1
    read_flags = {item["read"] for item in body["results"]}
    assert read_flags == {True, False}


@pytest.mark.asyncio
async def test_no_token_list_notifications_returns_401():
    async with _client() as client:
        response = await client.get("/v1/notifications")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mark_notification_read_persists():
    owner_id = await _create_user("test_notif_markread_1")
    notif_id = await _create_notification(owner_id)

    async with _client() as client:
        mark_response = await client.post(
            f"/v1/notifications/{notif_id}/read",
            headers=_auth_header(owner_id),
        )
        list_response = await client.get(
            "/v1/notifications",
            headers=_auth_header(owner_id),
        )

    assert mark_response.status_code == 204
    item = next(
        i for i in list_response.json()["results"] if i["id"] == notif_id
    )
    assert item["read"] is True


@pytest.mark.asyncio
async def test_mark_read_on_someone_elses_notification_returns_404():
    owner_id = await _create_user("test_notif_owner_2")
    other_id = await _create_user("test_notif_other_2")
    notif_id = await _create_notification(owner_id)

    async with _client() as client:
        response = await client.post(
            f"/v1/notifications/{notif_id}/read",
            headers=_auth_header(other_id),
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mark_all_notifications_read_persists():
    owner_id = await _create_user("test_notif_markall_1")
    await _create_notification(owner_id)
    await _create_notification(owner_id)

    async with _client() as client:
        mark_response = await client.post(
            "/v1/notifications/read-all",
            headers=_auth_header(owner_id),
        )
        list_response = await client.get(
            "/v1/notifications",
            headers=_auth_header(owner_id),
        )

    assert mark_response.status_code == 204
    assert list_response.json()["unread_count"] == 0
