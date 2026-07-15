import pytest
from app.repositories.audit_repository import AuditRepository


@pytest.mark.asyncio
async def test_create_persists_all_fields(db_session):
    repo = AuditRepository(db_session)
    entry = await repo.create(
        actor_id="admin-1",
        action="user.account_accepted",
        target_type="user",
        target_id="user-42",
        details={"note": "approved on review"},
    )

    assert entry.id is not None
    assert entry.actor_id == "admin-1"
    assert entry.action == "user.account_accepted"
    assert entry.target_type == "user"
    assert entry.target_id == "user-42"
    assert entry.details == {"note": "approved on review"}


@pytest.mark.asyncio
async def test_create_sets_created_at_from_db_default(db_session):
    repo = AuditRepository(db_session)
    entry = await repo.create(actor_id="admin-1", action="user.role_changed")

    assert entry.created_at is not None