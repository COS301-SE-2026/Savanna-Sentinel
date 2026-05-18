import pytest
from fastapi import HTTPException, status
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User

def create_mock_credentials(token_string="fake-jwt-string"):
    credientials = MagicMock()
    credientials.credentials = token_string
    return credientials

pytestmark = pytest.mark.asyncio

@pytest.fixture(autouse=True)
def mock_jwt_verify():
    patcher = patch("app.services.jwt_service.verify")
    mock_verify = patcher.start()

    yield mock_verify

    patcher.stop()

async def test_get_current_user_invalid_token(mock_jwt_verify):
    mock_jwt_verify.return_value = None
    credentials = create_mock_credentials()
    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as e:
        await get_current_user(credentials=credentials, db=mock_db)

    assert e.value.status_code  == status.HTTP_401_UNAUTHORIZED
    assert "Invalid access token" in e.value.detail

