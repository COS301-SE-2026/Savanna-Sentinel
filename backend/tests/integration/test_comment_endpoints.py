import asyncio
import os
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text

_BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


def _client():
    return AsyncClient(base_url=_BASE_URL)


def _register_payload(**overrides):
    base = {
        "username": "test_comment_user",
        "email": "test_comment_user@example.com",
        "password": "SecurePass1!",
        "first_name": "Test",
        "last_name": "Ranger",
        "requested_role": "ranger",
    }
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def cleanup_test_users(engine):
    yield

    async def _delete():
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "DELETE FROM comments WHERE report_id IN ("
                    "SELECT id FROM field_reports "
                    "WHERE description LIKE 'Test Report%')",
                ),
            )
            await conn.execute(
                text(
                    "DELETE FROM field_reports "
                    "WHERE description LIKE 'Test Report%'",
                ),
            )
            await conn.execute(
                text("DELETE FROM users WHERE username LIKE 'test_%'"),
            )

    asyncio.run(_delete())


async def _activate(engine, username: str) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE users SET is_active = true WHERE username = :username",
            ),
            {"username": username},
        )


async def _login(username: str, password: str) -> str:
    async with _client() as c:
        r = await c.post(
            "/v1/auth/login",
            json={"username": username, "password": password},
        )
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest_asyncio.fixture
async def ranger_token(engine):
    async with _client() as c:
        await c.post(
            "/v1/auth/register",
            json=_register_payload(
                username="test_comment_ranger",
                email="test_comment_ranger@example.com",
            ),
        )
    await _activate(engine, "test_comment_ranger")
    return await _login("test_comment_ranger", "SecurePass1!")


@pytest_asyncio.fixture
async def seeded_report(engine, ranger_token):
    report_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    async with engine.begin() as conn:
        result = await conn.execute(
            text("SELECT id FROM users WHERE username = :username"),
            {"username": "test_comment_ranger"},
        )
        submitted_by = str(result.scalar_one())

        await conn.execute(
            text(
                "INSERT INTO field_reports ("
                "id, submitted_by, report_type, description, "
                "location, occurred_at, created_at, status"
                ") VALUES ("
                ":id, :submitted_by, 'incident'::report_type, "
                "'Test Report Baseline', "
                "ST_SetSRID(ST_MakePoint(28.0473, -26.2041), 4326)"
                "::geography, "
                ":occurred_at, :created_at, 'open'"
                ")",
            ),
            {
                "id": report_id,
                "submitted_by": submitted_by,
                "occurred_at": now,
                "created_at": now,
            },
        )

    return report_id


@pytest.mark.asyncio
async def test_comment_endpoints_require_auth(seeded_report):
    async with _client() as c:
        res_post = await c.post(
            f"/v1/reports/{seeded_report}/comment",
            json={"body": "Unauthorized"},
        )
        res_get = await c.get(f"/v1/reports/{seeded_report}/comment")
        res_status = await c.post(
            f"/v1/reports/{seeded_report}/status/update",
            json={"status": "resolved"},
        )

    assert res_post.status_code in (401, 403)
    assert res_get.status_code in (401, 403)
    assert res_status.status_code in (401, 403)


@pytest.mark.asyncio
async def test_post_comment_success(ranger_token, seeded_report):
    payload = {
        "body": "Test comment",
        "photo_urls": ["http://minio/bucket/reports/footprint.jpg"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "in_progress",
    }

    async with _client() as c:
        r = await c.post(
            f"/v1/reports/{seeded_report}/comment",
            json=payload,
            headers={
                "Authorization": f"Bearer {ranger_token}",
            },
        )

    assert r.status_code == 201
    body = r.json()
    assert body["report_id"] == seeded_report
    assert body["author_username"] == "test_comment_ranger"
    assert body["body"] == payload["body"]
    assert len(body["photo_urls"]) == 1


@pytest.mark.asyncio
async def test_get_comments_returns_posted_comments(
    ranger_token,
    seeded_report,
):
    payload = {
        "body": "Test comment 2",
        "photo_urls": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    async with _client() as c:
        await c.post(
            f"/v1/reports/{seeded_report}/comment",
            json=payload,
            headers={"Authorization": f"Bearer {ranger_token}"},
        )

        r = await c.get(
            f"/v1/reports/{seeded_report}/comment",
            headers={"Authorization": f"Bearer {ranger_token}"},
        )

    assert r.status_code == 200
    comments = r.json()
    assert isinstance(comments, list)
    assert len(comments) >= 1
    assert comments[0]["body"] == "Test comment 2"


@pytest.mark.asyncio
async def test_update_report_status_success(ranger_token, seeded_report):
    status_payload = {
        "status": "resolved",
    }

    async with _client() as c:
        r = await c.post(
            f"/v1/reports/{seeded_report}/status/update",
            json=status_payload,
            headers={"Authorization": f"Bearer {ranger_token}"},
        )

    assert r.status_code == 200
