from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.services.notification_service import NotificationService

_USER_ID = "bbbbbbbb-0000-0000-0000-000000000001"


def _current_user(user_id: str = _USER_ID) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role="ranger", username="ranger1")


def _make_service(repo=None, user_repo=None) -> NotificationService:
    return NotificationService(
        repo or AsyncMock(),
        user_repo or AsyncMock(),
    )

@pytest.mark.asyncio
async def test_get_notifications_delegates_to_repo_with_current_user_id():
    repo = AsyncMock()
    repo.list_for_user.return_value = ([], 0, 0)
    service = _make_service(repo=repo)

    await service.get_notifications(_current_user(), page=2, page_size=10)

    repo.list_for_user.assert_called_once_with(
        user_id=_USER_ID,
        page=2,
        page_size=10,
    )


@pytest.mark.asyncio
async def test_get_notifications_returns_repo_tuple():
    repo = AsyncMock()
    items = [{"id": "n1", "title": "New tip-off"}]
    repo.list_for_user.return_value = (items, 1, 1)
    service = _make_service(repo=repo)

    results, total, unread_count = await service.get_notifications(
        _current_user(),
    )

    assert results == items
    assert total == 1
    assert unread_count == 1

@pytest.mark.asyncio
async def test_mark_read_succeeds_when_repo_updates_a_row():
    repo = AsyncMock()
    repo.mark_read.return_value = True
    service = _make_service(repo=repo)

    await service.mark_read(_current_user(), "notif-1")

    repo.mark_read.assert_called_once_with(_USER_ID, "notif-1")


@pytest.mark.asyncio
async def test_mark_read_raises_404_when_not_owned_or_missing():
    repo = AsyncMock()
    repo.mark_read.return_value = False
    service = _make_service(repo=repo)

    with pytest.raises(HTTPException) as exc:
        await service.mark_read(_current_user(), "notif-1")

    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_mark_all_read_delegates_to_repo_with_current_user_id():
    repo = AsyncMock()
    service = _make_service(repo=repo)

    await service.mark_all_read(_current_user())

    repo.mark_all_read.assert_called_once_with(_USER_ID)

@pytest.mark.asyncio
async def test_notify_roles_looks_up_ids_then_creates_for_them():
    repo = AsyncMock()
    user_repo = AsyncMock()
    user_repo.get_ids_by_roles.return_value = ["u1", "u2"]
    service = _make_service(repo=repo, user_repo=user_repo)

    await service.notify_roles(
        ["ranger", "analyst", "admin"],
        "tipoff_submitted",
        "New incident tip-off",
        "liaison1 reported: poaching near the river",
        related_type="tipoff",
        related_id="tip-1",
    )

    user_repo.get_ids_by_roles.assert_called_once_with(
        ["ranger", "analyst", "admin"],
    )
    repo.create_for_users.assert_called_once_with(
        user_ids=["u1", "u2"],
        type="tipoff_submitted",
        title="New incident tip-off",
        body="liaison1 reported: poaching near the river",
        related_type="tipoff",
        related_id="tip-1",
    )


@pytest.mark.asyncio
async def test_notify_roles_with_no_users_calls_repo_with_empty_list():
    repo = AsyncMock()
    user_repo = AsyncMock()
    user_repo.get_ids_by_roles.return_value = []
    service = _make_service(repo=repo, user_repo=user_repo)

    await service.notify_roles(["admin"], "ingestion_complete", "t", "b")

    repo.create_for_users.assert_called_once()
    assert repo.create_for_users.call_args.kwargs["user_ids"] == []

@pytest.mark.asyncio
async def test_notify_user_creates_for_a_single_recipient():
    repo = AsyncMock()
    service = _make_service(repo=repo)

    await service.notify_user(
        "solo-user",
        "ingestion_complete",
        "CSV ingestion complete",
        "42 records were ingested.",
    )

    repo.create_for_users.assert_called_once_with(
        user_ids=["solo-user"],
        type="ingestion_complete",
        title="CSV ingestion complete",
        body="42 records were ingested.",
        related_type=None,
        related_id=None,
    )
