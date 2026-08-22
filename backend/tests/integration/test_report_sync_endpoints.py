import asyncio
import uuid
from datetime import datetime, timedelta, timezone

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


async def _create_user(username: str, role: str = "ranger") -> str:
    async with _Session() as session:
        async with session.begin():
            result = await session.execute(
                text("""
                    INSERT INTO users
                        (email, username, first_name, last_name,
                         password_hash, role, is_active)
                    VALUES
                        (:email, :username, 'Test', 'User', :pw_hash,
                         :role, true)
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
                return str(row[0])
            existing = await session.execute(
                text("SELECT id FROM users WHERE username = :u"),
                {"u": username},
            )
            return str(existing.fetchone()[0])


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _occurred(days_ago: int = 1) -> str:
    moment = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return moment.isoformat()


def _entry(local_id: str, **overrides) -> dict:
    entry = {
        "local_id": local_id,
        "report_type": "incident",
        "location": {"lat": -24.2, "lon": 31.18},
        "occurred_at": _occurred(),
        "description": "Snare found near the fence",
        "incident_type": "Snare Found",
        "severity": "low",
    }
    entry.update(overrides)
    return entry


async def _count_by_client_id(client_id: str) -> int:
    async with _Session() as session:
        result = await session.execute(
            text(
                "SELECT COUNT(*) FROM field_reports WHERE client_id = :cid",
            ),
            {"cid": client_id},
        )
        return result.scalar()


async def _deleted_at(client_id: str):
    async with _Session() as session:
        result = await session.execute(
            text(
                "SELECT deleted_at FROM field_reports WHERE client_id = :cid",
            ),
            {"cid": client_id},
        )
        row = result.fetchone()
        return row[0] if row else None


_OWNED_EVENTS = """
    SELECT i.id FROM incidents i
    JOIN field_reports fr ON fr.id = i.field_report_id
    JOIN users u ON u.id = fr.submitted_by
    WHERE u.username LIKE 'test_sync_%'
    UNION
    SELECT s.id FROM sightings s
    JOIN field_reports fr ON fr.id = s.field_report_id
    JOIN users u ON u.id = fr.submitted_by
    WHERE u.username LIKE 'test_sync_%'
"""


@pytest.fixture(autouse=True)
def cleanup():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(
                text(
                    "DELETE FROM photos WHERE geospatial_event_id IN "
                    f"({_OWNED_EVENTS})",  # nosec B608
                ),
            )
            await conn.execute(
                text(
                    "DELETE FROM geospatial_events WHERE id IN "
                    f"({_OWNED_EVENTS})",  # nosec B608
                ),
            )
            await conn.execute(
                text("""
                    DELETE FROM field_reports
                    WHERE submitted_by IN (
                        SELECT id FROM users WHERE username LIKE 'test_sync_%'
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM refresh_tokens
                    WHERE user_id IN (
                        SELECT id FROM users WHERE username LIKE 'test_sync_%'
                    )
                """),
            )
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_sync_%'"),
            )

    asyncio.run(_delete())


@pytest.mark.asyncio
async def test_sync_creates_then_reports_conflict_on_replay():
    uid = await _create_user("test_sync_replay")
    local_id = str(uuid.uuid4())
    entry = _entry(local_id)

    async with _client() as c:
        first = await c.post(
            "/v1/reports/sync",
            json={"reports": [entry]},
            headers=_auth_header(uid),
        )
        second = await c.post(
            "/v1/reports/sync",
            json={"reports": [entry]},
            headers=_auth_header(uid),
        )

    assert first.status_code == 207
    assert second.status_code == 207
    assert first.json()["results"][0]["status"] == "created"
    assert second.json()["results"][0]["status"] == "conflict"
    assert await _count_by_client_id(local_id) == 1


@pytest.mark.asyncio
async def test_newer_occurred_at_updates_the_same_row():
    uid = await _create_user("test_sync_newer")
    local_id = str(uuid.uuid4())

    async with _client() as c:
        await c.post(
            "/v1/reports/sync",
            json={"reports": [_entry(local_id, occurred_at=_occurred(5))]},
            headers=_auth_header(uid),
        )
        newer = await c.post(
            "/v1/reports/sync",
            json={
                "reports": [
                    _entry(
                        local_id,
                        occurred_at=_occurred(1),
                        description="Updated in the field",
                    ),
                ],
            },
            headers=_auth_header(uid),
        )

    assert newer.json()["results"][0]["status"] == "updated"
    assert await _count_by_client_id(local_id) == 1


@pytest.mark.asyncio
async def test_offline_delete_is_propagated_as_a_soft_delete():
    uid = await _create_user("test_sync_delete")
    local_id = str(uuid.uuid4())

    async with _client() as c:
        await c.post(
            "/v1/reports/sync",
            json={"reports": [_entry(local_id)]},
            headers=_auth_header(uid),
        )
        removed = await c.post(
            "/v1/reports/sync",
            json={
                "reports": [
                    _entry(
                        local_id,
                        deleted_at=datetime.now(timezone.utc).isoformat(),
                    ),
                ],
            },
            headers=_auth_header(uid),
        )

    assert removed.json()["results"][0]["status"] == "deleted"
    assert await _deleted_at(local_id) is not None


@pytest.mark.asyncio
async def test_reports_must_be_an_array():
    uid = await _create_user("test_sync_badbody")

    async with _client() as c:
        r = await c.post(
            "/v1/reports/sync",
            json={"reports": "nope"},
            headers=_auth_header(uid),
        )

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_analyst_cannot_sync():
    uid = await _create_user("test_sync_analyst", role="analyst")

    async with _client() as c:
        r = await c.post(
            "/v1/reports/sync",
            json={"reports": []},
            headers=_auth_header(uid),
        )

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_submit_with_repeated_client_id_returns_the_same_report():
    """SC-11 idempotency, the single-report equivalent of the replay case."""
    uid = await _create_user("test_sync_idempotent")
    client_id = str(uuid.uuid4())
    payload = {
        "report_type": "incident",
        "location": {"lat": -24.2, "lon": 31.18},
        "occurred_at": _occurred(),
        "description": "Retried after a lost response",
        "incident_type": "Snare Found",
        "severity": "low",
        "client_id": client_id,
    }

    async with _client() as c:
        first = await c.post(
            "/v1/reports",
            json=payload,
            headers=_auth_header(uid),
        )
        second = await c.post(
            "/v1/reports",
            json=payload,
            headers=_auth_header(uid),
        )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["report_id"] == second.json()["report_id"]
    assert await _count_by_client_id(client_id) == 1


@pytest.mark.asyncio
async def test_client_id_is_scoped_per_user():
    """Ids come from devices, so two users may pick the same one."""
    first_uid = await _create_user("test_sync_userA")
    second_uid = await _create_user("test_sync_userB")
    shared_id = str(uuid.uuid4())
    entry = _entry(shared_id)

    async with _client() as c:
        first = await c.post(
            "/v1/reports/sync",
            json={"reports": [entry]},
            headers=_auth_header(first_uid),
        )
        second = await c.post(
            "/v1/reports/sync",
            json={"reports": [entry]},
            headers=_auth_header(second_uid),
        )

    assert first.json()["results"][0]["status"] == "created"
    assert second.json()["results"][0]["status"] == "created"
    assert await _count_by_client_id(shared_id) == 2
