import pytest
from sqlalchemy import text


# HELPERS TO GET A USER IN THE DB
def _register_user(username: str, email: str, role: str) -> dict:
    return{
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
    client.post("/v1/auth/register", json=_register_user(username, email, role))

    await _activate_user(db_session, username, role)
    login_response = client.post(
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

    response = client.post(
        "/v1/ingestion/upload",
        json=valid_body,
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "rows 1 to 1" in response.json()["message"]

@pytest.mark.asyncio
async def test_upload_flow_as_unauthorised_user(client, db_session, valid_body):
    headers = await _get_auth_headers(
        client,
        db_session,
        username="test",
        email="e@example.com",
        role="ranger",
    )

    response = client.post(
        "/v1/ingestion/upload",
        json=valid_body,
        headers=headers,
    )

    assert response.status_code == 403

@pytest.mark.asyncio
async def test_upload_missing_token(client, valid_body):
    response = client.post(
        "/v1/ingestion/upload",
        json=valid_body,
    )

    assert response.status_code == 401
