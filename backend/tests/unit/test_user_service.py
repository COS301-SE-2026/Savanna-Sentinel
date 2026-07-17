from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, status

from app.schemas.user import (
    UpdateProfileRequest,
    UsersRequest,
    UsersResultResponse,
)
from app.services.user_service import UserService

pytestmark = pytest.mark.asyncio


def _fake_user_repo(is_active=True, found=True):
    mock_repo = MagicMock()
    if found:
        mock_user = MagicMock(id="user-1", is_active=is_active)
        mock_repo.switch_status = AsyncMock(return_value=mock_user)
        mock_repo.update_role = AsyncMock(return_value=mock_user)
        mock_repo.admin_delete = AsyncMock(return_value=mock_user)
    else:
        mock_repo.switch_status = AsyncMock(return_value=None)
        mock_repo.update_role = AsyncMock(return_value=None)
        mock_repo.admin_delete = AsyncMock(return_value=None)
    return mock_repo

#This test file is kinda useless since the service doesnt do much
#except act like a middleman right now, but adding it
#in case like email and stuff gets addded

async def test_get_users_service_works():
    """Test that get_users works."""
    mock_repo = MagicMock()

    mock_users_list = [
        MagicMock(
            id="user-1",
            username="admin1",
            role="admin",
            is_active=True,
            email="a@test.com",
            first_name="Admin",
            last_name="User",
            hashed_password="mocked_hash",
            ),
        MagicMock(
            id="user-2",
            username="ranger1",
            role="ranger",
            is_active=True,
            email="r@test.com",
            first_name="Ranger",
            last_name="User",
            hashed_password="mocked_Hash",
            ),
    ]

    mock_repo.get_users = AsyncMock(return_value=mock_users_list)
    mock_repo.count_users = AsyncMock(return_value=2)

    service = UserService(repo=mock_repo)

    request_params = UsersRequest(
        page=1,
        page_size=10,
        is_active=True,
        role=None,
        )
    response = await service.get_users(request_params)

    assert isinstance(response, UsersResultResponse)
    assert response.total == 2
    assert response.page == 1
    assert response.page_size == 10
    assert len(response.results) == 2

    mock_repo.get_users.assert_called_once_with(request_params)
    mock_repo.count_users.assert_called_once_with(request_params)

async def test_switch_status_service_returns_none_when_user_not_found():
    """Test that switch_status returns none on a non-existant user."""
    mock_repo = MagicMock()
    mock_repo.switch_status = AsyncMock(return_value=None)

    service = UserService(repo=mock_repo)

    result = await service.switch_status(is_active=False, user_id="fake_id")

    assert result is None
    mock_repo.switch_status.assert_called_once_with(False, "fake_id")


async def test_switch_status_activate_logs_account_accepted():
    mock_audit = AsyncMock()
    service = UserService(
        repo=_fake_user_repo(is_active=True), audit_service=mock_audit,
    )

    await service.switch_status(
        is_active=True, user_id="user-1", actor_id="admin-1",
    )

    mock_audit.log.assert_awaited_once_with(
        actor_id="admin-1",
        action="user.account_accepted",
        target_type="user",
        target_id="user-1",
    )


async def test_switch_status_deactivate_logs_account_deactivated():
    mock_audit = AsyncMock()
    service = UserService(
        repo=_fake_user_repo(is_active=False), audit_service=mock_audit,
    )

    await service.switch_status(
        is_active=False, user_id="user-1", actor_id="admin-1",
    )

    mock_audit.log.assert_awaited_once_with(
        actor_id="admin-1",
        action="user.account_deactivated",
        target_type="user",
        target_id="user-1",
    )


async def test_switch_status_does_not_log_when_target_user_not_found():
    mock_audit = AsyncMock()
    service = UserService(
        repo=_fake_user_repo(found=False), audit_service=mock_audit,
    )

    result = await service.switch_status(
        is_active=True, user_id="missing", actor_id="admin-1",
    )

    assert result is None
    mock_audit.log.assert_not_awaited()

async def test_change_role_service_returns_updated_user():
    """Test that change_role() returns the updated user."""
    mock_repo = MagicMock()
    mock_user = MagicMock(id="user-1", username="ranger1", role="analyst")
    mock_repo.update_role = AsyncMock(return_value=mock_user)

    service = UserService(repo=mock_repo)

    result = await service.change_role(user_id="user-1", new_role="analyst")

    assert result is mock_user
    mock_repo.update_role.assert_called_once_with("user-1", "analyst")

async def test_change_role_service_returns_none_when_user_not_found():
    """Test that changing role on a non-existant user returns None."""
    mock_repo = MagicMock()
    mock_repo.update_role = AsyncMock(return_value=None)

    service = UserService(repo=mock_repo)

    result = await service.change_role(user_id="nonexistent", new_role="ranger")

    assert result is None
    mock_repo.update_role.assert_called_once_with("nonexistent", "ranger")


async def test_change_role_logs_new_role_in_details():
    mock_audit = AsyncMock()
    service = UserService(repo=_fake_user_repo(), audit_service=mock_audit)

    await service.change_role(
        user_id="user-1", new_role="analyst", actor_id="admin-1",
    )

    mock_audit.log.assert_awaited_once_with(
        actor_id="admin-1",
        action="user.role_changed",
        target_type="user",
        target_id="user-1",
        details={"new_role": "analyst"},
    )


async def test_admin_delete_logs_before_repo_delete_is_called():
    call_order = []
    mock_audit = AsyncMock()
    mock_audit.log.side_effect = lambda **_: call_order.append("log")

    fake_repo = _fake_user_repo()
    fake_repo.admin_delete.side_effect = lambda *_: call_order.append("delete")

    service = UserService(repo=fake_repo, audit_service=mock_audit)
    await service.admin_delete(user_id="user-1", actor_id="admin-1")

    assert call_order == ["log", "delete"]


async def test_admin_delete_logs_even_if_repo_delete_returns_none():
    mock_audit = AsyncMock()
    fake_repo = _fake_user_repo(found=False)  # simulates delete finding nothing
    service = UserService(repo=fake_repo, audit_service=mock_audit)

    await service.admin_delete(user_id="user-1", actor_id="admin-1")

    mock_audit.log.assert_awaited_once()


async def test_soft_delete_logs_user_soft_deleted():
    mock_repo = MagicMock()
    mock_user = MagicMock(id="user-1")
    mock_repo.soft_delete_user = AsyncMock(return_value=mock_user)
    mock_audit = AsyncMock()
    service = UserService(repo=mock_repo, audit_service=mock_audit)

    result = await service.soft_delete(user_id="user-1", actor_id="admin-1")

    assert result is mock_user
    mock_audit.log.assert_awaited_once_with(
        actor_id="admin-1",
        action="user.soft_deleted",
        target_type="user",
        target_id="user-1",
    )


async def test_soft_delete_returns_none_and_does_not_log_when_ineligible():
    mock_repo = MagicMock()
    mock_repo.soft_delete_user = AsyncMock(return_value=None)
    mock_audit = AsyncMock()
    service = UserService(repo=mock_repo, audit_service=mock_audit)

    result = await service.soft_delete(user_id="user-1", actor_id="admin-1")

    assert result is None
    mock_audit.log.assert_not_awaited()


# get_me() tests
async def test_get_me_returns_current_user():
    """Test that get_me() returns the passed user object."""
    mock_repo = MagicMock()
    mock_user = MagicMock(
        id="user-1",
        username="test_user",
        role="ranger",
        is_active=True,
        )

    service = UserService(repo=mock_repo)
    result = service.get_me(mock_user)

    assert result is mock_user


# update_me() tests
async def test_update_me_updates_first_name_only():
    """Test that update_me() updates first_name when provided."""
    mock_repo = MagicMock()
    mock_user = MagicMock(
        id="user-1", username="test", first_name="Old", last_name="Name",
        hashed_password="hash", email="test@test.com",
    )
    updated_user = MagicMock(first_name="New", last_name="Name")
    mock_repo.save_user = AsyncMock(return_value=updated_user)

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name="New",
        last_name=None,
        current_password=None,
        new_password=None,
        )
    result = await service.update_me(mock_user, body)

    assert result is updated_user
    assert mock_user.first_name == "New"
    mock_repo.save_user.assert_called_once()


async def test_update_me_updates_last_name_only():
    """Test that update_me() updates last_name when provided."""
    mock_repo = MagicMock()
    mock_user = MagicMock(
        id="user-1", username="test", first_name="First", last_name="Old",
        hashed_password="hash", email="test@test.com",
    )
    updated_user = MagicMock(first_name="First", last_name="New")
    mock_repo.save_user = AsyncMock(return_value=updated_user)

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name="New",
        current_password=None,
        new_password=None,
        )
    result = await service.update_me(mock_user, body)

    assert result is updated_user
    assert mock_user.last_name == "New"
    mock_repo.save_user.assert_called_once()


async def test_update_me_rejects_empty_first_name():
    """Test that update_me() rejects empty first_name."""
    mock_repo = MagicMock()
    mock_user = MagicMock(
        first_name="Old",
        last_name="Name",
        hashed_password="hash",
        )

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name="   ",
        last_name=None,
        current_password=None,
        new_password=None,
        )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_me(mock_user, body)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "First name cannot be empty" in exc_info.value.detail


async def test_update_me_rejects_empty_last_name():
    """Test that update_me() rejects empty last_name."""
    mock_repo = MagicMock()
    mock_user = MagicMock(
        first_name="First",
        last_name="Old",
        hashed_password="hash",
        )

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name="",
        current_password=None,
        new_password=None,
        )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_me(mock_user, body)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Last name cannot be empty" in exc_info.value.detail


async def test_update_me_rejects_no_updates():
    """Test that update_me() rejects empty payload."""
    mock_repo = MagicMock()
    mock_user = MagicMock()

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name=None,
        current_password=None,
        new_password=None)

    with pytest.raises(HTTPException) as exc_info:
        await service.update_me(mock_user, body)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "No updatable fields provided" in exc_info.value.detail


async def test_update_me_rejects_short_password():
    """Test that update_me() rejects password shorter than 8 chars."""
    mock_repo = MagicMock()
    mock_user = MagicMock(hashed_password="hash")

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name=None,
        current_password="old",
        new_password="short",
        )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_me(mock_user, body)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "at least 8 characters" in exc_info.value.detail


async def test_update_me_rejects_password_without_current():
    """Test update_me() requires current_password when changing password."""
    mock_repo = MagicMock()
    mock_user = MagicMock(hashed_password="hash")

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name=None,
        current_password=None,
        new_password="ValidPass1!",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_me(mock_user, body)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Current password is required" in exc_info.value.detail


@patch("app.services.user_service.verify_password")
async def test_update_me_rejects_wrong_current_password(mock_verify):
    """Test that update_me() rejects incorrect current_password."""
    mock_verify.return_value = False
    mock_repo = MagicMock()
    mock_user = MagicMock(hashed_password="hash")

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name=None,
        current_password="wrong",
        new_password="ValidPass1!",
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.update_me(mock_user, body)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Current password is incorrect" in exc_info.value.detail


@patch("app.services.user_service.get_password_hash")
@patch("app.services.user_service.verify_password")
async def test_update_me_updates_password_and_revokes_tokens(
        mock_verify,
        mock_hash,
        ):
    """Test that update_me() updates password and revokes old tokens."""
    mock_verify.return_value = True
    mock_hash.return_value = "newhash"
    mock_repo = MagicMock()
    mock_user = MagicMock(id="user-1", hashed_password="oldhash")
    updated_user = MagicMock(hashed_password="newhash")
    mock_repo.save_user = AsyncMock(return_value=updated_user)
    mock_repo.revoke_all_refresh_tokens = AsyncMock()

    service = UserService(repo=mock_repo)
    body = UpdateProfileRequest(
        first_name=None,
        last_name=None,
        current_password="old",
        new_password="ValidPass1!")
    result = await service.update_me(mock_user, body)

    assert result is updated_user
    assert mock_user.hashed_password == "newhash"
    mock_repo.revoke_all_refresh_tokens.assert_called_once_with("user-1")
    mock_repo.save_user.assert_called_once()
