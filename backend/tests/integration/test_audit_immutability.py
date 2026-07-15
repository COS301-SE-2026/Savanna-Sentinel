import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models.audit_log import AuditLog
from app.models.user import User

_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # sonar:disable:S2068
    "postgresql+asyncpg://sentinel:sentinel_dev_password@localhost:5432/savanna_sentinel",
)

_engine = create_async_engine(_DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session():
    async with _Session() as session:
        yield session


@pytest_asyncio.fixture
async def seeded_audit_log(db_session):
    actor = User(
        username="test_audit_immutable_actor",
        email="test_audit_immutable_actor@example.com",
        first_name="Test",
        last_name="Immutable",
        hashed_password="hashed",
        role="admin",
        is_active=True,
    )
    db_session.add(actor)
    await db_session.commit()
    await db_session.refresh(actor)

    entry = AuditLog(actor_id=actor.id, action="user.role_changed")
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)

    yield entry

    async with _engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM users WHERE username = :username"),
            {"username": "test_audit_immutable_actor"},
        )


@pytest.mark.asyncio
async def test_update_on_audit_logs_raises(db_session, seeded_audit_log):
    with pytest.raises(DBAPIError, match="insert-only"):
        await db_session.execute(
            text("UPDATE audit_logs SET action = 'tampered' WHERE id = :id"),
            {"id": seeded_audit_log.id},
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_delete_on_audit_logs_raises(db_session, seeded_audit_log):
    with pytest.raises(DBAPIError, match="insert-only"):
        await db_session.execute(
            text("DELETE FROM audit_logs WHERE id = :id"),
            {"id": seeded_audit_log.id},
        )
        await db_session.commit()
