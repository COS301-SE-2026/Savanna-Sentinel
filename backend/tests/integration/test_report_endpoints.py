import asyncio
import os

import pytest
from httpx import ASGITransport, AsyncClient
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
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _create_user(
    username: str, role: str = "ranger", is_active: bool = True
) -> str:
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO users
                    (email, username, first_name, last_name, password_hash, role, is_active)
                VALUES
                    (:email, :username, 'Test', 'User', :pw_hash, :role, :is_active)
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
        # user already existed
        r2 = await conn.execute(
            text("SELECT id FROM users WHERE username = :u"), {"u": username}
        )
        return str(r2.fetchone()[0])


async def _create_report(user_id: str, lng: float = 28.1, lat: float = -25.7) -> str:
    wkt = f"POINT({lng} {lat})"
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO field_reports
                    (submitted_by, report_type, description, location, occurred_at)
                VALUES
                    (:uid, 'incident', 'Test incident',
                     ST_GeogFromText(:wkt),
                     NOW() - INTERVAL '1 hour')
                RETURNING id
            """),
            {"uid": user_id, "wkt": wkt},
        )
        return str(result.fetchone()[0])


async def _soft_delete_report(report_id: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("UPDATE field_reports SET deleted_at = NOW() WHERE id = :rid"),
            {"rid": report_id},
        )


def _auth_header(user_id: str) -> dict:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def cleanup():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(
                text("""
                    DELETE FROM field_reports
                    WHERE submitted_by IN (
                        SELECT id FROM users WHERE username LIKE 'test_%'
                    )
                """)
            )
            await conn.execute(
                text("""
                    DELETE FROM refresh_tokens
                    WHERE user_id IN (
                        SELECT id FROM users WHERE username LIKE 'test_%'
                    )
                """)
            )
            await conn.execute(text("DELETE FROM users WHERE username LIKE 'test_%'"))

    asyncio.run(_delete())


@pytest.mark.asyncio
async def test_ranger_gets_own_report_returns_200():
    uid = await _create_user("test_ranger_sc21")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == rid
    assert body["submitted_by"] == uid
    assert body["report_type"] == "incident"
    assert body["location"]["type"] == "Point"
    assert len(body["location"]["coordinates"]) == 2


@pytest.mark.asyncio
async def test_ranger_blocked_from_other_rangers_report_returns_403():
    owner_id = await _create_user("test_owner_sc21")
    other_id = await _create_user("test_other_sc21")
    rid = await _create_report(owner_id)
    async with _client() as c:
        r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(other_id))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_gets_any_report_returns_200():
    ranger_id = await _create_user("test_ranger2_sc21")
    admin_id = await _create_user("test_admin_sc21", role="admin")
    rid = await _create_report(ranger_id)
    async with _client() as c:
        r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(admin_id))
    assert r.status_code == 200
    assert r.json()["id"] == rid


@pytest.mark.asyncio
async def test_nonexistent_report_returns_404():
    uid = await _create_user("test_ranger3_sc21")
    fake_id = "00000000-0000-0000-0000-000000000000"
    async with _client() as c:
        r = await c.get(f"/v1/reports/{fake_id}", headers=_auth_header(uid))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_soft_deleted_report_returns_404():
    uid = await _create_user("test_ranger4_sc21")
    rid = await _create_report(uid)
    await _soft_delete_report(rid)
    async with _client() as c:
        r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_no_token_returns_401():
    async with _client() as c:
        r = await c.get("/v1/reports/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_analyst_blocked_returns_403():
    analyst_id = await _create_user("test_analyst_sc21", role="analyst")
    uid = await _create_user("test_ranger5_sc21")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(analyst_id))
    assert r.status_code == 403
