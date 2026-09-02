import pytest
from sqlalchemy import text


# HELPERS TO GET A USER IN THE DB
def _register_user(username: str, email: str, role: str) -> dict:
    return {
        "username": username,
        "email": email,
        "password": "SecurePass1!",
        "first_name": "test",
        "last_name": "user",
        "requested_role": role,
    }


async def _activate_user(db_session, username: str, target_role: str) -> None:
    await db_session.execute(
        text(
            "UPDATE users "
            "SET is_active = :is_active, role = :role "
            "WHERE username = :username",
        ),
        {"is_active": True, "role": target_role, "username": username},
    )
    await db_session.commit()


async def _get_auth_headers(
    client,
    db_session,
    username: str,
    email: str,
    role: str,
) -> dict[str, str]:
    await client.post(
        "/v1/auth/register",
        json=_register_user(username, email, role),
    )

    await _activate_user(db_session, username, role)
    login_response = await client.post(
        "/v1/auth/login",
        json={"username": username, "password": "SecurePass1!"},
    )

    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# FIXTURES


@pytest.fixture
def valid_body():
    return {
        "start_row": 1,
        "records": [
            {
                "record_id": 1,
                "ingestion_timestamp": "2026-03-15T08:30:00Z",
                "source_system": "ERP",
                "data_domain": "Finance",
                "event_type": "Invoice",
                "payload_size_kb": 100,
                "priority_level": "HIGH",
                "retry_count": 0,
                "is_encrypted": True,
                "status": "PENDING",
            },
        ],
    }


@pytest.fixture
def invalid_body():
    return {
        "start_row": 1,
        "records": [
            {
                "record_id": 1,
                "ingestion_timestamp": "2026-03-15T08:30:00Z",
                "source_system": "ERP",
                "data_domain": "Finance",
                "event_type": "Invoice",
                "payload_size_kb": "not-an-int",
                "priority_level": "HIGH",
                "retry_count": 0,
                "is_encrypted": True,
                "status": "PENDING",
            },
        ],
    }


# INTEGRATION TESTS


@pytest.mark.asyncio
async def test_upload_flow_as_authorised_analyst(
    client,
    db_session,
    valid_body,
):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst",
        email="analyst@example.com",
        role="analyst",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        json=valid_body,
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "rows 1 to 1" in response.json()["message"]


@pytest.mark.asyncio
async def test_upload_is_recorded_in_audit_log(client, db_session, valid_body):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst_audit",
        email="analyst_audit@example.com",
        role="analyst",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        json={**valid_body, "filename": "sightings_q1.csv"},
        headers=headers,
    )
    assert response.status_code == 200

    row = (
        await db_session.execute(
            text(
                "SELECT a.action, a.target_type, a.details "
                "FROM audit_logs a JOIN users u ON u.id = a.actor_id "
                "WHERE u.username = :username "
                "ORDER BY a.created_at DESC LIMIT 1",
            ),
            {"username": "test_analyst_audit"},
        )
    ).first()

    assert row is not None
    assert row.action == "ingestion.csv_uploaded"
    assert row.target_type == "ingestion"
    assert row.details["filename"] == "sightings_q1.csv"
    assert row.details["record_count"] == 1


@pytest.mark.asyncio
async def test_upload_flow_as_unauthorised_user(client, db_session, valid_body):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test",
        email="e@example.com",
        role="ranger",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        json=valid_body,
        headers=headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_upload_missing_token(client, valid_body):
    response = await client.post(
        "/v1/ingestion/upload",
        json=valid_body,
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_invalid_body(client, db_session, invalid_body):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst",
        email="analyst@example.com",
        role="analyst",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        json=invalid_body,
        headers=headers,
    )

    assert response.status_code == 422


# Right now this is a successful operation, since it shouldnt modify
# can be modified to 400 if necessary
@pytest.mark.asyncio
async def test_upload_empty_records_list(client, db_session):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst",
        email="analyst@example.com",
        role="analyst",
    )

    empty_records = {
        "start_row": 1,
        "records": [],
    }

    response = await client.post(
        "/v1/ingestion/upload",
        json=empty_records,
        headers=headers,
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_upload_malkformed_json(client, db_session):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst",
        email="analyst@example.com",
        role="analyst",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        content="{'start_row': 1, 'records': [this is completely broken json}",
        headers={**headers, "Content-Type": "application/json"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_notifies_the_uploading_analyst(
    client,
    db_session,
    valid_body,
):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst_notif",
        email="analyst_notif@example.com",
        role="analyst",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        json={**valid_body, "filename": "sightings_q1.csv"},
        headers=headers,
    )
    assert response.status_code == 200

    notif_response = await client.get("/v1/notifications", headers=headers)
    items = notif_response.json()["results"]
    matching = [n for n in items if n["type"] == "ingestion_complete"]
    assert len(matching) == 1
    assert "sightings_q1.csv" in matching[0]["body"]


@pytest.mark.asyncio
async def test_upload_non_json_content(client, db_session, valid_body):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test_analyst",
        email="analyst@example.com",
        role="analyst",
    )

    response = await client.post(
        "/v1/ingestion/upload",
        data=valid_body,
        headers=headers,
    )

    assert response.status_code == 422
