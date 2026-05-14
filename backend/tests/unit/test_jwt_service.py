import pytest
from app.services import jwt_service

# Defining reusable data for tests
@pytest.fixture
def valid_user_data():
    return {
        "id": 1,
        "username": "SomeValidUserName",
        "email": "test@email.com",
        "is_active": True
    }

def test_enocde_and_decode_success(valid_user_data):
    """Test that valid user data can be encoded and decoded back"""

    token = jwt_service.encode(token)
    assert isinstance(token, str)

    decoded_payload = jwt_service.decode(token)
    assert decoded_payload["username"] == valid_user_data.get("username")
    assert "exp" in decoded_payload

