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
            # user already existed
            r2 = await session.execute(
                text("SELECT id FROM users WHERE username = :u"),
                {"u": username},
            )
            return str(r2.fetchone()[0])


async def _create_report(
    user_id: str,
    lng: float = 28.1,
    lat: float = -25.7,
) -> str:
    wkt = f"POINT({lng} {lat})"
    async with _Session() as session:
        async with session.begin():
            result = await session.execute(
                text("""
                    INSERT INTO field_reports
                        (submitted_by, report_type, description, location,
                    occurred_at)
                    VALUES
                        (:uid, 'incident', 'Test incident',
                        ST_GeogFromText(:wkt),
                        NOW() - INTERVAL '1 hour')
                    RETURNING id
                """),
                {"uid": user_id, "wkt": wkt},
            )
            return str(result.fetchone()[0])


async def _create_sighting_report(
    user_id: str,
    lng: float = 28.1,
    lat: float = -25.7,
) -> str:
    wkt = f"POINT({lng} {lat})"
    async with _engine.begin() as conn:
        fr_result = await conn.execute(
            text("""
                INSERT INTO field_reports
                    (submitted_by, report_type, description, location,
                  occurred_at)
                VALUES
                    (:uid, 'sighting', 'Test sighting',
                     ST_GeogFromText(:wkt),
                     NOW() - INTERVAL '1 hour')
                RETURNING id
            """),
            {"uid": user_id, "wkt": wkt},
        )
        report_id = str(fr_result.fetchone()[0])

        ev_result = await conn.execute(
            text("""
                INSERT INTO geospatial_events (event_type, location,
                 occurred_at)
                VALUES ('sighting', ST_GeogFromText(:wkt), NOW() - INTERVAL
                  '1 hour')
                RETURNING id
            """),
            {"wkt": wkt},
        )
        event_id = str(ev_result.fetchone()[0])

        await conn.execute(
            text("""
                INSERT INTO sightings (id, field_report_id, species, count)
                VALUES (:id, :fr_id, 'Elephant', 4)
            """),
            {"id": event_id, "fr_id": report_id},
        )

    return report_id


async def _soft_delete_report(report_id: str) -> None:
    async with _Session() as session:
        async with session.begin():
            await session.execute(
                text(
                    "UPDATE field_reports "
                    "SET deleted_at = NOW() "
                    "WHERE id = :rid",
                ),
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
                    DELETE FROM photos
                    WHERE geospatial_event_id IN (
                        SELECT i.id FROM incidents i
                        JOIN field_reports fr ON fr.id = i.field_report_id
                        JOIN users u ON u.id = fr.submitted_by
                        WHERE u.username LIKE 'test_%'
                        UNION
                        SELECT s.id FROM sightings s
                        JOIN field_reports fr ON fr.id = s.field_report_id
                        JOIN users u ON u.id = fr.submitted_by
                        WHERE u.username LIKE 'test_%'
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM geospatial_events
                    WHERE id IN (
                        SELECT i.id FROM incidents i
                        JOIN field_reports fr ON fr.id = i.field_report_id
                        JOIN users u ON u.id = fr.submitted_by
                        WHERE u.username LIKE 'test_%'
                        UNION
                        SELECT s.id FROM sightings s
                        JOIN field_reports fr ON fr.id = s.field_report_id
                        JOIN users u ON u.id = fr.submitted_by
                        WHERE u.username LIKE 'test_%'
                    )
                """),
            )
            await conn.execute(
                text("""
                    DELETE FROM field_reports
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


def _incident_payload(**overrides) -> dict:
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    body = {
        "report_type": "incident",
        "location": {"lat": -25.7, "lon": 28.1},
        "occurred_at": past,
        "description": "Snare found near waterhole",
        "incident_type": "poaching",
    }
    body.update(overrides)
    return body


def _sighting_payload(**overrides) -> dict:
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    body = {
        "report_type": "sighting",
        "location": {"lat": -25.7, "lon": 28.1},
        "occurred_at": past,
        "description": "Elephant herd at river",
        "species": "African Elephant",
    }
    body.update(overrides)
    return body


# POST /v1/reports


@pytest.mark.asyncio
async def test_ranger_submits_incident_report_returns_201():
    uid = await _create_user("test_ranger_sc11a")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_incident_payload(),
            headers=_auth_header(uid),
        )
    assert r.status_code == 201
    body = r.json()
    assert body["report_type"] == "incident"
    assert body["status"] == "submitted"
    assert body["submitted_by"] == uid
    assert "report_id" in body
    assert "created_at" in body


@pytest.mark.asyncio
async def test_ranger_submits_sighting_report_returns_201():
    uid = await _create_user("test_ranger_sc11b")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_sighting_payload(),
            headers=_auth_header(uid),
        )
    assert r.status_code == 201
    assert r.json()["report_type"] == "sighting"


@pytest.mark.asyncio
async def test_admin_submits_report_returns_201():
    uid = await _create_user("test_admin_sc11", role="admin")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_incident_payload(),
            headers=_auth_header(uid),
        )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_analyst_blocked_from_submit_returns_403():
    uid = await _create_user("test_analyst_sc11", role="analyst")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_incident_payload(),
            headers=_auth_header(uid),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_community_liaison_blocked_from_submit_returns_403():
    uid = await _create_user("test_liaison_sc11", role="community_liaison")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_incident_payload(),
            headers=_auth_header(uid),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_no_token_submit_returns_401():
    async with _client() as c:
        r = await c.post("/v1/reports", json=_incident_payload())
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_future_occurred_at_returns_422():
    uid = await _create_user("test_ranger_sc11c")
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_incident_payload(occurred_at=future),
            headers=_auth_header(uid),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_missing_incident_type_for_incident_returns_400():
    uid = await _create_user("test_ranger_sc11d")
    payload = _incident_payload()
    del payload["incident_type"]
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=payload,
            headers=_auth_header(uid),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_missing_species_for_sighting_returns_400():
    uid = await _create_user("test_ranger_sc11e")
    payload = _sighting_payload()
    del payload["species"]
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=payload,
            headers=_auth_header(uid),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_invalid_coordinates_returns_422():
    uid = await _create_user("test_ranger_sc11f")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_incident_payload(location={"lat": 95.0, "lon": 28.1}),
            headers=_auth_header(uid),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_submit_with_severity_and_count():
    uid = await _create_user("test_ranger_sc11g")
    async with _client() as c:
        r = await c.post(
            "/v1/reports",
            json=_sighting_payload(count=5),
            headers=_auth_header(uid),
        )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_submitted_report_appears_in_list():
    uid = await _create_user("test_ranger_sc11h")
    async with _client() as c:
        post_r = await c.post(
            "/v1/reports",
            json=_incident_payload(),
            headers=_auth_header(uid),
        )
        assert post_r.status_code == 201
        report_id = post_r.json()["report_id"]
        list_r = await c.get("/v1/reports", headers=_auth_header(uid))
    ids = [item["report_id"] for item in list_r.json()["results"]]
    assert report_id in ids


# PATCH /v1/reports/{report_id}


@pytest.mark.asyncio
async def test_ranger_updates_own_report_returns_200():
    uid = await _create_user("test_ranger_sc12a")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"description": "Updated after follow-up"},
            headers=_auth_header(uid),
        )
    assert r.status_code == 200
    body = r.json()
    assert body["report_id"] == rid
    assert body["status"] == "updated"
    assert body["submitted_by"] == uid


@pytest.mark.asyncio
async def test_update_persists_and_reflects_in_get():
    uid = await _create_user("test_ranger_sc12b")
    rid = await _create_report(uid)
    async with _client() as c:
        patch_r = await c.patch(
            f"/v1/reports/{rid}",
            json={"description": "Snare removed and area cleared"},
            headers=_auth_header(uid),
        )
        assert patch_r.status_code == 200
        get_r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert get_r.json()["description"] == "Snare removed and area cleared"


@pytest.mark.asyncio
async def test_update_sighting_species_and_count():
    uid = await _create_user("test_ranger_sc12c")
    rid = await _create_sighting_report(uid)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"species": "Lion", "count": 2},
            headers=_auth_header(uid),
        )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_ranger_blocked_from_updating_other_report_returns_403():
    owner_id = await _create_user("test_owner_sc12")
    other_id = await _create_user("test_other_sc12")
    rid = await _create_report(owner_id)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"description": "hijacked"},
            headers=_auth_header(other_id),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_updates_any_report_returns_200():
    ranger_id = await _create_user("test_ranger2_sc12")
    admin_id = await _create_user("test_admin_sc12", role="admin")
    rid = await _create_report(ranger_id)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"description": "Admin correction"},
            headers=_auth_header(admin_id),
        )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_update_nonexistent_report_returns_404():
    uid = await _create_user("test_ranger3_sc12")
    fake_id = "00000000-0000-0000-0000-000000000000"
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{fake_id}",
            json={"description": "does not exist"},
            headers=_auth_header(uid),
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_no_fields_returns_400():
    uid = await _create_user("test_ranger4_sc12")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={},
            headers=_auth_header(uid),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_update_future_occurred_at_returns_422():
    uid = await _create_user("test_ranger5_sc12")
    rid = await _create_report(uid)
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"occurred_at": future},
            headers=_auth_header(uid),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_invalid_coordinates_returns_422():
    uid = await _create_user("test_ranger6_sc12")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"location": {"lat": 95.0, "lon": 28.1}},
            headers=_auth_header(uid),
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_no_token_returns_401():
    async with _client() as c:
        r = await c.patch(
            "/v1/reports/00000000-0000-0000-0000-000000000000",
            json={"description": "no auth"},
        )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_analyst_blocked_from_update_returns_403():
    analyst_id = await _create_user("test_analyst_sc12", role="analyst")
    uid = await _create_user("test_ranger7_sc12")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"description": "not allowed"},
            headers=_auth_header(analyst_id),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_soft_deleted_report_returns_404():
    uid = await _create_user("test_ranger8_sc12")
    rid = await _create_report(uid)
    await _soft_delete_report(rid)
    async with _client() as c:
        r = await c.patch(
            f"/v1/reports/{rid}",
            json={"description": "resurrect attempt"},
            headers=_auth_header(uid),
        )
    assert r.status_code == 404


# DELETE /v1/reports/{report_id}


@pytest.mark.asyncio
async def test_ranger_deletes_own_report_returns_204():
    uid = await _create_user("test_ranger_sc13a")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.delete(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_deleted_report_excluded_from_get():
    uid = await _create_user("test_ranger_sc13b")
    rid = await _create_report(uid)
    async with _client() as c:
        del_r = await c.delete(f"/v1/reports/{rid}", headers=_auth_header(uid))
        assert del_r.status_code == 204
        get_r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert get_r.status_code == 404


@pytest.mark.asyncio
async def test_deleted_report_excluded_from_list():
    uid = await _create_user("test_ranger_sc13c")
    rid = await _create_report(uid)
    async with _client() as c:
        del_r = await c.delete(f"/v1/reports/{rid}", headers=_auth_header(uid))
        assert del_r.status_code == 204
        list_r = await c.get("/v1/reports", headers=_auth_header(uid))
    ids = [item["report_id"] for item in list_r.json()["results"]]
    assert rid not in ids


@pytest.mark.asyncio
async def test_ranger_blocked_from_deleting_other_report_returns_403():
    owner_id = await _create_user("test_owner_sc13")
    other_id = await _create_user("test_other_sc13")
    rid = await _create_report(owner_id)
    async with _client() as c:
        r = await c.delete(f"/v1/reports/{rid}", headers=_auth_header(other_id))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_deletes_any_report_returns_204():
    ranger_id = await _create_user("test_ranger2_sc13")
    admin_id = await _create_user("test_admin_sc13", role="admin")
    rid = await _create_report(ranger_id)
    async with _client() as c:
        r = await c.delete(f"/v1/reports/{rid}", headers=_auth_header(admin_id))
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_report_returns_404():
    uid = await _create_user("test_ranger3_sc13")
    fake_id = "00000000-0000-0000-0000-000000000000"
    async with _client() as c:
        r = await c.delete(f"/v1/reports/{fake_id}", headers=_auth_header(uid))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_already_deleted_report_returns_404():
    uid = await _create_user("test_ranger4_sc13")
    rid = await _create_report(uid)
    await _soft_delete_report(rid)
    async with _client() as c:
        r = await c.delete(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_no_token_returns_401():
    async with _client() as c:
        r = await c.delete(
            "/v1/reports/00000000-0000-0000-0000-000000000000",
        )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_analyst_blocked_from_delete_returns_403():
    analyst_id = await _create_user("test_analyst_sc13", role="analyst")
    uid = await _create_user("test_ranger5_sc13")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.delete(
            f"/v1/reports/{rid}",
            headers=_auth_header(analyst_id),
        )
    assert r.status_code == 403


# GET /v1/reports/{report_id}


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
async def test_get_report_includes_uploaded_images():
    uid = await _create_user("test_ranger_sc21a")
    image_urls = [
        "http://localhost:9000/savanna-sentinel-media/reports/a.jpg",
        "http://localhost:9000/savanna-sentinel-media/reports/b.jpg",
    ]
    async with _client() as c:
        post_r = await c.post(
            "/v1/reports",
            json=_incident_payload(images=image_urls),
            headers=_auth_header(uid),
        )
        assert post_r.status_code == 201
        rid = post_r.json()["report_id"]
        get_r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(uid))
    assert get_r.status_code == 200
    returned = sorted(get_r.json()["images"])
    for stored, signed in zip(sorted(image_urls), returned):
        assert signed.startswith(stored)
        assert "X-Amz-Signature=" in signed


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
async def test_analyst_can_view_others_report():
    analyst_id = await _create_user("test_analyst_sc21", role="analyst")
    uid = await _create_user("test_ranger5_sc21")
    rid = await _create_report(uid)
    async with _client() as c:
        r = await c.get(f"/v1/reports/{rid}", headers=_auth_header(analyst_id))
    assert r.status_code == 200
    assert r.json()["id"] == rid


# GET /v1/reports


@pytest.mark.asyncio
async def test_list_returns_200_with_pagination_envelope():
    uid = await _create_user("test_ranger_sc20a")
    await _create_report(uid)
    async with _client() as c:
        r = await c.get("/v1/reports", headers=_auth_header(uid))
    assert r.status_code == 200
    body = r.json()
    assert "total" in body
    assert "page" in body
    assert "page_size" in body
    assert "results" in body
    assert isinstance(body["results"], list)


@pytest.mark.asyncio
async def test_list_ranger_sees_only_own_reports():
    uid = await _create_user("test_ranger_sc20b")
    other_id = await _create_user("test_other_sc20b")
    await _create_report(uid)
    await _create_report(other_id)
    async with _client() as c:
        r = await c.get("/v1/reports", headers=_auth_header(uid))
    body = r.json()
    assert all(item["submitted_by"] == uid for item in body["results"])


@pytest.mark.asyncio
async def test_list_admin_sees_all_reports():
    ranger_id = await _create_user("test_ranger_sc20c")
    admin_id = await _create_user("test_admin_sc20c", role="admin")
    await _create_report(ranger_id)
    async with _client() as c:
        r = await c.get("/v1/reports", headers=_auth_header(admin_id))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


@pytest.mark.asyncio
async def test_list_response_item_shape():
    uid = await _create_user("test_ranger_sc20d")
    await _create_report(uid)
    async with _client() as c:
        r = await c.get("/v1/reports", headers=_auth_header(uid))
    item = r.json()["results"][0]
    assert "report_id" in item
    assert "location" in item
    assert "lat" in item["location"]
    assert "lon" in item["location"]
    assert "sync_status" in item
    assert item["sync_status"] == "synced"


@pytest.mark.asyncio
async def test_list_includes_signed_view_urls_for_uploaded_images():
    uid = await _create_user("test_ranger_sc20h")
    stored_url = "http://localhost:9000/savanna-sentinel-media/reports/c.jpg"
    async with _client() as c:
        post_r = await c.post(
            "/v1/reports",
            json=_incident_payload(images=[stored_url]),
            headers=_auth_header(uid),
        )
        assert post_r.status_code == 201
        list_r = await c.get("/v1/reports", headers=_auth_header(uid))
    item = next(
        i
        for i in list_r.json()["results"]
        if i["report_id"] == post_r.json()["report_id"]
    )
    assert item["images"][0].startswith(stored_url)
    assert "X-Amz-Signature=" in item["images"][0]


@pytest.mark.asyncio
async def test_list_filter_by_report_type():
    uid = await _create_user("test_ranger_sc20e")
    await _create_report(uid)
    async with _client() as c:
        r = await c.get(
            "/v1/reports?report_type=incident",
            headers=_auth_header(uid),
        )
    assert r.status_code == 200
    assert all(
        item["report_type"] == "incident" for item in r.json()["results"]
    )


@pytest.mark.asyncio
async def test_list_pagination():
    uid = await _create_user("test_ranger_sc20f")
    for _ in range(3):
        await _create_report(uid)
    async with _client() as c:
        r = await c.get(
            "/v1/reports?page=1&page_size=2",
            headers=_auth_header(uid),
        )
    body = r.json()
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["results"]) <= 2


@pytest.mark.asyncio
async def test_list_no_token_returns_401():
    async with _client() as c:
        r = await c.get("/v1/reports")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_list_analyst_sees_all_reports():
    ranger_id = await _create_user("test_ranger_sc20i")
    analyst_id = await _create_user("test_analyst_sc20", role="analyst")
    await _create_report(ranger_id)
    async with _client() as c:
        r = await c.get("/v1/reports", headers=_auth_header(analyst_id))
    assert r.status_code == 200
    assert r.json()["total"] >= 1


@pytest.mark.asyncio
async def test_list_sync_status_offline_returns_empty():
    uid = await _create_user("test_ranger_sc20g")
    await _create_report(uid)
    async with _client() as c:
        r = await c.get(
            "/v1/reports?sync_status=offline",
            headers=_auth_header(uid),
        )
    body = r.json()
    assert body["total"] == 0
    assert body["results"] == []
