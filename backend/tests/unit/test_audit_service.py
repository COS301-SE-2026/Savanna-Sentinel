from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from app.schemas.audit import AuditLogFilterRequest
from app.services.audit_service import AuditService


def _filter_req(**kwargs):
    defaults = {"page": 1, "page_size": 20}
    defaults.update(kwargs)
    return AuditLogFilterRequest(**defaults)


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


@pytest.mark.asyncio
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
        "admin-1", "user.deleted", "user", "user-9", {"reason": "rejected registration"},
    )


@pytest.mark.asyncio
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
