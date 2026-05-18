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