import asyncio
import uuid

import pytest
import pytest_asyncio
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


@pytest.fixture(autouse=True)
def cleanup(engine):
    yield

    async def _delete():
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "DELETE FROM patrol_routes WHERE requested_by IN "
                    "(SELECT id FROM users WHERE username LIKE 'test_route_%')",
                ),
            )
            await conn.execute(
                text(
                    "DELETE FROM refresh_tokens WHERE user_id IN "
                    "(SELECT id FROM users WHERE username LIKE 'test_route_%')",
                ),
            )
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_route_%'"),
            )

    asyncio.run(_delete())


@pytest_asyncio.fixture
async def ranger_token(db_session) -> str:
    uid = await _create_user(db_session, "test_route_ranger", "ranger")
    return create_access_token(uid)


@pytest_asyncio.fixture
async def other_ranger_token(db_session) -> str:
    uid = await _create_user(db_session, "test_route_other_ranger", "ranger")
    return create_access_token(uid)


@pytest_asyncio.fixture
async def admin_token(db_session) -> str:
    uid = await _create_user(db_session, "test_route_admin", "admin")
    return create_access_token(uid)


def _valid_save_payload(**overrides) -> dict:
    body = {
        "request_id": str(uuid.uuid4()),
        "start_point": {"type": "Point", "coordinates": [31.18, -24.2]},
        "end_point": {"type": "Point", "coordinates": [31.19, -24.21]},
        "max_time": 120.0,
        "max_fuel": 40.0,
        "risk_by_cell": {"cell-1": 0.5},
        "route": {
            "suggested_path": ["a", "b"],
            "path_geometry": {
                "type": "LineString",
                "coordinates": [[31.18, -24.2], [31.19, -24.21]],
            },
            "estimated_time_min": 90.0,
            "estimated_fuel_l": 30.0,
            "risk_coverage": 0.7,
        },
    }
    body.update(overrides)
    return body

@pytest.mark.asyncio
async def test_save_route_requires_authentication(client):
    r = await client.post("/v1/routes/save", json=_valid_save_payload())
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_save_route_without_max_time_or_max_fuel(client, ranger_token):
    r = await client.post(
        "/v1/routes/save",
        json=_valid_save_payload(max_time=None, max_fuel=None),
        headers={"Authorization": f"Bearer {ranger_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["max_time"] is None
    assert body["max_fuel"] is None


@pytest.mark.asyncio
async def test_save_and_list_route_roundtrip(client, ranger_token):
    save_resp = await client.post(
        "/v1/routes/save",
        json=_valid_save_payload(),
        headers={"Authorization": f"Bearer {ranger_token}"},
    )
    assert save_resp.status_code == 201

    list_resp = await client.get(
        "/v1/routes/saved",
        headers={"Authorization": f"Bearer {ranger_token}"},
    )
    assert list_resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_saved_route_is_scoped_to_owner(
    client,
    ranger_token,
    other_ranger_token,
):
    await client.post(
        "/v1/routes/save",
        json=_valid_save_payload(),
        headers={"Authorization": f"Bearer {ranger_token}"},
    )
    other_list = await client.get(
        "/v1/routes/saved",
        headers={"Authorization": f"Bearer {other_ranger_token}"},
    )
    assert other_list.json()["total"] == 0


@pytest.mark.asyncio
async def test_get_saved_route_id_does_not_collide_with_get_route_by_id(
    client,
    admin_token,
):
    r = await client.get(
        "/v1/routes/saved",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "status" not in body
    assert "results" in body
    assert "total" in body
