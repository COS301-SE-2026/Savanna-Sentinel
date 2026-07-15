import pytest
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditLogFilterRequest


def _filter_req(**kwargs):
    defaults = {"page": 1, "page_size": 20}
    defaults.update(kwargs)
    return AuditLogFilterRequest(**defaults)


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


@pytest.mark.asyncio
async def test_list_logs_filters_by_action(db_session):
    repo = AuditRepository(db_session)
    await repo.create(actor_id="admin-1", action="user.role_changed", target_id="u1")
    await repo.create(actor_id="admin-1", action="user.deleted", target_id="u2")

    req = _filter_req(action="user.deleted")
    results = await repo.list_logs(req)

    assert len(results) == 1
    assert results[0].action == "user.deleted"


@pytest.mark.asyncio
async def test_list_logs_orders_newest_first(db_session):
    repo = AuditRepository(db_session)
    first = await repo.create(actor_id="admin-1", action="user.role_changed")
    second = await repo.create(actor_id="admin-1", action="user.deleted")

    results = await repo.list_logs(_filter_req())

    assert results[0].id == second.id
    assert results[1].id == first.id


@pytest.mark.asyncio
async def test_count_logs_matches_filtered_total(db_session):
    repo = AuditRepository(db_session)
    await repo.create(actor_id="admin-1", action="user.deleted")
    await repo.create(actor_id="admin-2", action="user.deleted")
    await repo.create(actor_id="admin-1", action="user.role_changed")

    req = _filter_req(actor_id="admin-1")
    total = await repo.count_logs(req)

    assert total == 2


def test_repository_exposes_no_update_or_delete_method():
    assert not hasattr(AuditRepository, "update")
    assert not hasattr(AuditRepository, "delete")