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

def test_encode_invalid_data_raises_validation_error():
    """Test that passing invalid data types raises a ValueError"""

    bad_data = {
        "id": "not-an-int",
        "username": "Bam",
        "email": "bad-email",
        "is_active": True
    }

    with pytest.raises(ValueError):
        jwt_service.encode(bad_data)

def test_decode_invalid_token():
    """Test that a gardbage token returns None"""

    result = jwt_service.decode("this.is.not.a.real.jwt.token")
    assert result is None