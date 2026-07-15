from unittest.mock import AsyncMock, MagicMock

import pytest

from app.repositories.audit_repository import AuditRepository
from tests.schema_helpers import audit_filter_req as _filter_req


def _mock_session():
    session = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_create_builds_entry_from_given_fields():
    # Arrange
    mock_db = _mock_session()
    repo = AuditRepository(mock_db)

    # Act
    entry = await repo.create(
        actor_id="admin-1",
        action="user.account_accepted",
        target_type="user",
        target_id="user-42",
        details={"note": "approved on review"},
    )

    # Assert
    assert entry.actor_id == "admin-1"
    assert entry.action == "user.account_accepted"
    assert entry.target_type == "user"
    assert entry.target_id == "user-42"
    assert entry.details == {"note": "approved on review"}


@pytest.mark.asyncio
async def test_create_adds_commits_and_refreshes_in_order():
    # Arrange
    mock_db = _mock_session()
    repo = AuditRepository(mock_db)

    # Act
    entry = await repo.create(actor_id="admin-1", action="user.role_changed")

    # Assert
    mock_db.add.assert_called_once_with(entry)
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once_with(entry)


@pytest.mark.asyncio
async def test_list_logs_returns_scalars_from_execute_result():
    # Arrange
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = ["entry-1", "entry-2"]
    mock_db = _mock_session()
    mock_db.execute.return_value = mock_result
    repo = AuditRepository(mock_db)

    # Act
    results = await repo.list_logs(_filter_req())

    # Assert
    assert results == ["entry-1", "entry-2"]
    mock_db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_count_logs_returns_scalar_one_from_execute_result():
    # Arrange
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 3
    mock_db = _mock_session()
    mock_db.execute.return_value = mock_result
    repo = AuditRepository(mock_db)

    # Act
    total = await repo.count_logs(_filter_req())

    # Assert
    assert total == 3
    mock_db.execute.assert_awaited_once()

def test_repository_exposes_no_update_or_delete_method():
    assert not hasattr(AuditRepository, "update")
    assert not hasattr(AuditRepository, "delete")
