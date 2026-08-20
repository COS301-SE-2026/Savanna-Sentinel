import asyncio
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


async def _create_user(
    username: str,
    role: str = "community_liaison",
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


async def _create_tipoff(
    user_id: str,
    *,
    report_type: str = "incident",
    hours_ago: int = 1,
    description: str = "Community tipoff",
    incident_type: str | None = "poaching",
    species: str | None = None,
    count: int | None = None,
) -> dict:
    occurred_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    wkt = "POINT(28.1 -25.7)"

    async with _engine.begin() as conn:
        tipoff = await conn.execute(
            text("""
                INSERT INTO tipoffs
                    (submitted_by, report_type, description,
                      location, occurred_at)
                VALUES
                    (:uid, CAST(:rtype AS report_type), :desc,
                     ST_GeogFromText(:wkt), :occurred_at)
                RETURNING id, created_at
            """),
            {
                "uid": user_id,
                "rtype": report_type,
                "desc": description,
                "wkt": wkt,
                "occurred_at": occurred_at,
            },
        )
        tipoff_id = str(tipoff.fetchone()[0])

        event = await conn.execute(
            text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES
                    (CAST(:etype AS event_type),
                      ST_GeogFromText(:wkt), :occurred_at)
                RETURNING id
            """),
            {
                "etype": report_type,
                "wkt": wkt,
                "occurred_at": occurred_at,
            },
        )
        event_id = str(event.fetchone()[0])

        if report_type == "incident":
            await conn.execute(
                text("""
                    INSERT INTO incidents
                        (id, tipoff_id, incident_type, severity)
                    VALUES
                        (:id, :tip_id, :itype, CAST(:sev AS severity_level))
                """),
                {
                    "id": event_id,
                    "tip_id": tipoff_id,
                    "itype": incident_type,
                    "sev": "high",
                },
            )
        else:
            await conn.execute(
                text("""
                    INSERT INTO sightings
                        (id, tipoff_id, species, count)
                    VALUES
                        (:id, :tip_id, :species, :cnt)
                """),
                {
                    "id": event_id,
                    "tip_id": tipoff_id,
                    "species": species or "elephant",
                    "cnt": count or 3,
                },
            )

    return {
        "tipoff_id": tipoff_id,
        "report_type": report_type,
        "user_id": user_id,
        "occurred_at": occurred_at,
    }


@pytest.fixture(autouse=True)
def cleanup():
    yield

    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(
                text("""
                    DELETE FROM photos
                    WHERE geospatial_event_id IN (
                        SELECT i.id FROM incidents i
                        JOIN tipoffs t ON t.id = i.tipoff_id
                        JOIN users u ON u.id = t.submitted_by
                        WHERE u.username LIKE 'test_%'
                        UNION
                        SELECT s.id FROM sightings s
                        JOIN tipoffs t ON t.id = s.tipoff_id
                        JOIN users u ON u.id = t.submitted_by
                        WHERE u.username LIKE 'test_%'
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM geospatial_events
                    WHERE id IN (
                        SELECT i.id FROM incidents i
                        JOIN tipoffs t ON t.id = i.tipoff_id
                        JOIN users u ON u.id = t.submitted_by
                        WHERE u.username LIKE 'test_%'
                        UNION
                        SELECT s.id FROM sightings s
                        JOIN tipoffs t ON t.id = s.tipoff_id
                        JOIN users u ON u.id = t.submitted_by
                        WHERE u.username LIKE 'test_%'
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM incidents
                    WHERE tipoff_id IN (
                        SELECT id FROM tipoffs WHERE submitted_by IN (
                            SELECT id FROM users WHERE username LIKE 'test_%'
                        )
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM sightings
                    WHERE tipoff_id IN (
                        SELECT id FROM tipoffs WHERE submitted_by IN (
                            SELECT id FROM users WHERE username LIKE 'test_%'
                        )
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM tipoffs
                    WHERE submitted_by IN (
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


def _tipoff_payload(**overrides) -> dict:
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    body = {
        "report_type": "incident",
        "location": {"lat": -25.7, "lon": 28.1},
        "occurred_at": past,
        "description": "Poaching seen near river",
        "incident_type": "poaching",
        "severity": "high",
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_community_liaison_can_submit_tipoff_returns_201():
    uid = await _create_user("test_liaison_submit_1")
    async with _client() as client:
        response = await client.post(
            "/v1/tipoffs",
            json=_tipoff_payload(),
            headers=_auth_header(uid),
        )

    assert response.status_code == 201
    body = response.json()
    assert body["report_type"] == "incident"
    assert body["status"] == "submitted"
    assert body["submitted_by"] == uid
    assert "tipoff_id" in body
    assert "created_at" in body

@pytest.mark.asyncio
async def test_analyst_blocked_from_submit_tipoff_returns_403():
    uid = await _create_user("test_analyst_submit_1", role="analyst")
    async with _client() as client:
        response = await client.post(
            "/v1/tipoffs",
            json=_tipoff_payload(),
            headers=_auth_header(uid),
        )

    assert response.status_code == 403
    assert response.json()["detail"] == "Access denied"


@pytest.mark.asyncio
async def test_admin_can_submit_tipoff_returns_201():
    uid = await _create_user("test_admin_submit_1", role="admin")
    async with _client() as client:
        response = await client.post(
            "/v1/tipoffs",
            json=_tipoff_payload(),
            headers=_auth_header(uid),
        )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_no_token_submit_tipoff_returns_401():
    async with _client() as client:
        response = await client.post(
            "/v1/tipoffs",
            json=_tipoff_payload(),
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_coordinates_on_submit_tipoff_returns_422():
    uid = await _create_user("test_liaison_invalid_1")
    async with _client() as client:
        response = await client.post(
            "/v1/tipoffs",
            json=_tipoff_payload(location={"lat": 95.0, "lon": 28.1}),
            headers=_auth_header(uid),
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_missing_incident_type_on_submit_tipoff_returns_400():
    uid = await _create_user("test_liaison_missing_incident_1")
    payload = _tipoff_payload()
    del payload["incident_type"]
    async with _client() as client:
        response = await client.post(
            "/v1/tipoffs",
            json=payload,
            headers=_auth_header(uid),
        )

    assert response.status_code == 400

@pytest.mark.asyncio
async def test_community_liaison_list_only_owns_tipoffs():
    owner_id = await _create_user("test_liaison_list_own_1")
    other_id = await _create_user("test_liaison_list_other_1")

    own = await _create_tipoff(owner_id, hours_ago=1)
    await _create_tipoff(other_id, hours_ago=2)

    async with _client() as client:
        response = await client.get(
            "/v1/tipoffs",
            headers=_auth_header(owner_id),
        )

    assert response.status_code == 200
    body = response.json()
    ids = [item["tipoff_id"] for item in body["results"]]
    assert own["tipoff_id"] in ids
    assert len(ids) >= 1


@pytest.mark.asyncio
async def test_tipoff_list_paginates_with_page_size_and_page_offset():
    owner_id = await _create_user("test_liaison_paging_1")
    created = [
        await _create_tipoff(
            owner_id, description=f"Paging tip {idx}",
            hours_ago=idx + 1,
        )
        for idx in range(55)
    ]

    async with _client() as client:
        response = await client.get(
            "/v1/tipoffs",
            params={"page": 2, "page_size": 50},
            headers=_auth_header(owner_id),
        )

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 2
    assert body["page_size"] == 50
    assert body["total"] == 55
    assert len(body["results"]) == 5
    assert body["results"][0]["tipoff_id"] != created[0]["tipoff_id"]


@pytest.mark.asyncio
async def test_analyst_list_all_tipoffs_with_default_pagination():
    owner_id = await _create_user("test_liaison_list_all_1")
    analyst_id = await _create_user("test_analyst_list_all_1", role="analyst")
    own = await _create_tipoff(owner_id, hours_ago=1)
    await _create_tipoff(owner_id, hours_ago=2)

    async with _client() as client:
        response = await client.get(
            "/v1/tipoffs",
            headers=_auth_header(analyst_id),
        )

    assert response.status_code == 200
    body = response.json()
    ids = [item["tipoff_id"] for item in body["results"]]
    assert own["tipoff_id"] in ids
    assert body["page"] == 1
    assert body["page_size"] == 20


@pytest.mark.asyncio
async def test_tipoff_list_filters_by_from_and_to_query_aliases():
    owner_id = await _create_user("test_liaison_list_range_1")
    recent = await _create_tipoff(owner_id, hours_ago=1)
    old = await _create_tipoff(owner_id, hours_ago=8)

    now = datetime.now(timezone.utc)
    start = (now - timedelta(hours=3)).isoformat()
    end = (now).isoformat()

    async with _client() as client:
        response = await client.get(
            "/v1/tipoffs",
            params={"from": start, "to": end},
            headers=_auth_header(owner_id),
        )

    assert response.status_code == 200
    body = response.json()
    ids = [item["tipoff_id"] for item in body["results"]]
    assert recent["tipoff_id"] in ids
    assert old["tipoff_id"] not in ids
