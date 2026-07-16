import pytest
import pytest_asyncio
from sqlalchemy import text

from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from tests.schema_helpers import audit_filter_req as _filter_req


@pytest_asyncio.fixture
async def actor(db_session, engine):
    user = User(
        username="test_audit_repo_actor",
        email="test_audit_repo_actor@example.com",
        first_name="Test",
        last_name="Actor",
        hashed_password="hashed",  # NOSONAR
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    yield user

    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM users WHERE id = :id"), {"id": user.id},
        )


@pytest.mark.asyncio
async def test_create_persists_all_fields_and_populates_defaults(
    db_session, actor,
):
    repo = AuditRepository(db_session)

    entry = await repo.create(
        actor_id=actor.id,
        action="user.account_accepted",
        target_type="user",
        target_id=actor.id,
        details={"note": "approved on review"},
    )

    assert entry.id is not None
    assert entry.created_at is not None
    assert entry.actor_id == actor.id
    assert entry.action == "user.account_accepted"
    assert entry.details == {"note": "approved on review"}


@pytest.mark.asyncio
async def test_list_logs_filters_by_action(db_session, actor):
    repo = AuditRepository(db_session)
    await repo.create(actor_id=actor.id, action="user.role_changed")
    await repo.create(actor_id=actor.id, action="user.deleted")

    req = _filter_req(actor_id=actor.id, action="user.deleted")
    results = await repo.list_logs(req)

    assert len(results) == 1
    assert results[0].action == "user.deleted"


@pytest.mark.asyncio
async def test_list_logs_orders_newest_first(db_session, actor):
    repo = AuditRepository(db_session)
    first = await repo.create(actor_id=actor.id, action="user.role_changed")
    second = await repo.create(actor_id=actor.id, action="user.deleted")

    req = _filter_req(actor_id=actor.id)
    results = await repo.list_logs(req)

    assert results[0].id == second.id
    assert results[1].id == first.id


@pytest.mark.asyncio
async def test_count_logs_matches_filtered_total(db_session, actor):
    repo = AuditRepository(db_session)
    await repo.create(actor_id=actor.id, action="user.deleted")
    await repo.create(actor_id=actor.id, action="user.role_changed")

    req = _filter_req(actor_id=actor.id)
    total = await repo.count_logs(req)

    assert total == 2
