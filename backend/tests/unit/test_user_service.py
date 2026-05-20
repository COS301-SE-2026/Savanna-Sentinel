import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.user_service import UserService
from app.schemas.user import UsersRequest, UsersResultResponse, UsersResponse

pytestmark = pytest.mark.asyncio

#This test file is kinda useless since the service doesnt do much except act like a middleman right now, but adding it in case like email and stuff gets addded

async def test_get_users_service_works():
    mock_repo = MagicMock()

    mock_users_list = [
        MagicMock(id="user-1", username="admin1", role="admin", is_active=True, email="a@test.com", first_name="Admin", last_name="User", hashed_password="mocked_hash"),
        MagicMock(id="user-2", username="ranger1", role="ranger", is_active=True, email="r@test.com", first_name="Ranger", last_name="User", hashed_password="mocked_Hash")
    ]

    mock_repo.get_users = AsyncMock(return_value=mock_users_list)
    mock_repo.count_users = AsyncMock(return_value=2)

    service = UserService(repo=mock_repo)

    request_params = UsersRequest(page=1, page_size=10, is_active=True, role=None)
    response = await service.get_users(request_params)

    assert isinstance(response, UsersResultResponse)
    assert response.total == 2
    assert response.page == 1
    assert response.page_size == 10
    assert len(response.results) == 2

    mock_repo.get_users.assert_called_once_with(request_params)
    mock_repo.count_users.assert_called_once_with(request_params)

async def test_switch_status_service_returns_none_when_user_not_found():
    mock_repo = MagicMock()
    mock_repo.switch_status = AsyncMock(return_value=None)

    service = UserService(repo=mock_repo)

    result = await service.switch_status(is_active=False, user_id="fake_id")

    assert result is None
    mock_repo.switch_status.assert_called_once_with(False, "fake_id")

async def test_change_role_service_returns_updated_user():
    mock_repo = MagicMock()
    mock_user = MagicMock(id="user-1", username="ranger1", role="analyst")
    mock_repo.update_role = AsyncMock(return_value=mock_user)

    service = UserService(repo=mock_repo)

    result = await service.change_role(user_id="user-1", new_role="analyst")

    assert result is mock_user
    mock_repo.update_role.assert_called_once_with("user-1", "analyst")

async def test_change_role_service_returns_none_when_user_not_found():
    mock_repo = MagicMock()
    mock_repo.update_role = AsyncMock(return_value=None)

    service = UserService(repo=mock_repo)

    result = await service.change_role(user_id="nonexistent", new_role="ranger")

    assert result is None
    mock_repo.update_role.assert_called_once_with("nonexistent", "ranger")