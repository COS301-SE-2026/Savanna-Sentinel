from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.audit_service import AuditService
from tests.schema_helpers import audit_filter_req as _filter_req

pytestmark = pytest.mark.asyncio


@pytest.fixture
def fake_audit_log():
    return SimpleNamespace(
        id="log-1",
        actor_id="admin-1",
        action="user.role_changed",
        target_type="user",
        target_id="user-9",
        details=None,
        created_at=datetime.now(timezone.utc),
    )


async def test_log_calls_repo_create_with_given_arguments():
    mock_repo = AsyncMock()
    service = AuditService(mock_repo)

    await service.log(
        actor_id="admin-1",
        action="user.deleted",
        target_type="user",
        target_id="user-9",
        details={"reason": "rejected registration"},
    )

    mock_repo.create.assert_awaited_once_with(
        "admin-1", "user.deleted", "user", "user-9",
        {"reason": "rejected registration"},
    )


async def test_get_logs_returns_paginated_response(fake_audit_log):
    mock_repo = AsyncMock()
    mock_repo.list_logs.return_value = [fake_audit_log]
    mock_repo.count_logs.return_value = 1
    service = AuditService(mock_repo)

    req = _filter_req(page=1, page_size=20)
    response = await service.get_logs(req)

    assert response.total == 1
    assert response.page == 1
    assert len(response.results) == 1
    assert response.results[0].action == fake_audit_log.action


async def test_get_logs_resolves_actor_username(fake_audit_log):
    mock_repo = AsyncMock()
    mock_repo.list_logs.return_value = [fake_audit_log]
    mock_repo.count_logs.return_value = 1
    mock_user_repo = AsyncMock()
    mock_user_repo.get_username_by_id.return_value = "admin_jane"

    service = AuditService(mock_repo, mock_user_repo)
    response = await service.get_logs(_filter_req(page=1, page_size=20))

    assert response.results[0].actor_username == "admin_jane"
    mock_user_repo.get_username_by_id.assert_any_await("admin-1")


async def test_get_logs_resolves_target_username_only_for_user_targets(fake_audit_log):
    mock_repo = AsyncMock()
    mock_repo.list_logs.return_value = [fake_audit_log]  # target_type="user"
    mock_repo.count_logs.return_value = 1
    mock_user_repo = AsyncMock()
    mock_user_repo.get_username_by_id.return_value = "target_ranger"

    service = AuditService(mock_repo, mock_user_repo)
    response = await service.get_logs(_filter_req(page=1, page_size=20))

    assert response.results[0].target_username == "target_ranger"


async def test_get_logs_skips_target_lookup_for_non_user_target(fake_audit_log):
    fake_audit_log.target_type = "report"
    mock_repo = AsyncMock()
    mock_repo.list_logs.return_value = [fake_audit_log]
    mock_repo.count_logs.return_value = 1
    mock_user_repo = AsyncMock()
    mock_user_repo.get_username_by_id.return_value = "should_not_be_used"

    service = AuditService(mock_repo, mock_user_repo)
    response = await service.get_logs(_filter_req(page=1, page_size=20))

    assert response.results[0].target_username is None


async def test_get_logs_without_user_repo_leaves_usernames_none(fake_audit_log):
    mock_repo = AsyncMock()
    mock_repo.list_logs.return_value = [fake_audit_log]
    mock_repo.count_logs.return_value = 1

    service = AuditService(mock_repo)  # no user_repo - backward compatible
    response = await service.get_logs(_filter_req(page=1, page_size=20))

    assert response.results[0].actor_username is None
    assert response.results[0].target_username is None
