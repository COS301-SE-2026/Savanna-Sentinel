from unittest.mock import AsyncMock

import pytest
from app.services.audit_service import AuditService


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
