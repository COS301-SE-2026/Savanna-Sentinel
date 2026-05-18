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
    patcher = patch("app.core.dependencies.verify")
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

async def test_get_current_user_missing_id_in_token(mock_jwt_verify):
    mock_token_body = MagicMock(spec=[])
    mock_jwt_verify.return_value = mock_token_body
    credentials = create_mock_credentials()
    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as e:
        await get_current_user(credentials=credentials, db=mock_db)

    assert e.value.status_code  == status.HTTP_401_UNAUTHORIZED
    assert "Token is missing user id" in e.value.detail

@patch("app.core.dependencies.UserRepository")
async def test_get_current_user_deactivated(mock_user_repo, mock_jwt_verify):
    mock_token_body = MagicMock()
    mock_token_body.id = "user-123"
    mock_jwt_verify.return_value = mock_token_body

    mock_user = User(
        id="user-123", username="test", role="ranger", is_active=False, email="a@test.com", first_name="Test", last_name="User", hashed_password="HashedPassword"
    )
    mock_repo = MagicMock()
    mock_repo.get_user_by_id = AsyncMock()
    mock_repo.get_user_by_id.return_value = mock_user
    mock_user_repo.return_value = mock_repo

    credentials = create_mock_credentials()
    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as e:
        await get_current_user(credentials=credentials, db=mock_db)
        
    assert e.value.status_code == status.HTTP_403_FORBIDDEN
    assert "User account has been deactivated" in e.value.detail

@patch("app.core.dependencies.UserRepository")
async def test_get_current_user_success(mock_user_repo, mock_jwt_verify):
    mock_token_body = MagicMock()
    mock_token_body.id = "user-123"
    mock_jwt_verify.return_value = mock_token_body

    mock_user = User(
        id="user-123", username="test", role="ranger", is_active=True, email="a@test.com", first_name="Test", last_name="User", hashed_password="HashedPassword"
    )

    mock_repo = MagicMock()
    mock_repo.get_user_by_id = AsyncMock()
    mock_repo.get_user_by_id.return_value = mock_user
    mock_user_repo.return_value = mock_repo

    credentials = create_mock_credentials()
    mock_db = AsyncMock()

    result = await get_current_user(credentials=credentials, db=mock_db)

    assert result == mock_user

async def test_require_admin_allows_admin_role():
    mock_user = User(
        id="user-123", username="test", role="admin", is_active=True, email="a@test.com", first_name="Test", last_name="User", hashed_password="HashedPassword"
    )

    result = await require_admin(current_user=mock_user)

    assert result == mock_user

async def test_require_admin_raises_403_for_non_admin():
    mock_user = User(
        id="user-123", username="test", role="ranger", is_active=True, email="a@test.com", first_name="Test", last_name="User", hashed_password="HashedPassword"
    )

    with pytest.raises(HTTPException) as e:
        await require_admin(current_user=mock_user)

    assert e.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Admin privileges required" in e.value.detail
