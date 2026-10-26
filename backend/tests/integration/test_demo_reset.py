import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.repositories.demo_repository import DemoRepository

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_SEEDED_USER_COUNT = 24
_KLASERIE_LAYER_COUNT = 13
_KLASERIE_FEATURE_COUNT = 23


@asynccontextmanager
async def _rolled_back_session():
    """Yield a session whose commits are savepoints inside one rollback."""
    async with _engine.connect() as conn:
        transaction = await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            async with session_factory() as session:
                yield session
        finally:
            await transaction.rollback()


async def _scalar(session, sql: str, params: dict | None = None):
    result = await session.execute(text(sql), params or {})
    return result.scalar()


async def _make_demo_changes(session) -> tuple[str, uuid.UUID]:
    """Change admin1 and add a demo visitor, returning admin1's id and jti."""
    admin_id = await _scalar(
        session,
        "UPDATE users SET email = 'admin-private@savanna.test' "
        "WHERE username = 'admin1' RETURNING id",
    )
    jti = uuid.uuid4()
    await session.execute(
        text("""
            INSERT INTO refresh_tokens (jti, user_id, expires_at)
            VALUES (:jti, :user_id, :expires_at)
        """),
        {
            "jti": jti,
            "user_id": admin_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        },
    )
    await session.execute(
        text("""
            INSERT INTO users
                (username, email, password_hash, first_name, last_name,
                 role, is_active)
            VALUES
                ('test_demo_visitor', 'test_demo_visitor@savanna.test',
                 :pw_hash, 'Demo', 'Visitor', 'ranger', TRUE)
        """),
        {"pw_hash": get_password_hash("SecurePass1!")},
    )
    await session.execute(
        text("""
            INSERT INTO audit_logs (actor_id, action)
            VALUES (:actor_id, 'test.demo_action')
        """),
        {"actor_id": admin_id},
    )
    await session.execute(
        text("UPDATE workspace_meta SET version = version + 5"),
    )
    return str(admin_id), jti


@pytest.mark.asyncio
async def test_reset_restores_seed_data_without_reports():
    async with _rolled_back_session() as session:
        await _make_demo_changes(session)

        await DemoRepository(session).reset_database("admin1")

        assert await _scalar(
            session,
            "SELECT COUNT(*) FROM users WHERE username = 'test_demo_visitor'",
        ) == 0
        assert await _scalar(
            session, "SELECT COUNT(*) FROM users",
        ) == _SEEDED_USER_COUNT
        assert await _scalar(session, "SELECT COUNT(*) FROM audit_logs") == 0
        assert await _scalar(
            session, "SELECT version FROM workspace_meta",
        ) == 0
        assert await _scalar(
            session, "SELECT COUNT(*) FROM workspace_layers",
        ) == 0
        assert await _scalar(
            session, "SELECT COUNT(*) FROM workspace_features",
        ) == 0
        assert await _scalar(
            session, "SELECT COUNT(*) FROM field_reports",
        ) == 0
        assert await _scalar(session, "SELECT COUNT(*) FROM tipoffs") == 0


@pytest.mark.asyncio
async def test_reset_keeps_admin1_account_and_refresh_tokens():
    async with _rolled_back_session() as session:
        admin_id, jti = await _make_demo_changes(session)

        await DemoRepository(session).reset_database("admin1")

        admin = (
            await session.execute(
                text("SELECT id, email FROM users WHERE username = 'admin1'"),
            )
        ).one()
        assert str(admin.id) == admin_id
        assert admin.email == "admin-private@savanna.test"
        assert await _scalar(
            session,
            "SELECT user_id FROM refresh_tokens WHERE jti = :jti",
            {"jti": jti},
        ) == admin.id


@pytest.mark.asyncio
async def test_klaserie_insert_replaces_the_workspace():
    async with _rolled_back_session() as session:
        admin_id = await _scalar(
            session, "SELECT id FROM users WHERE username = 'admin1'",
        )
        await session.execute(
            text("""
                INSERT INTO workspace_layers (id, name, display_order)
                VALUES (gen_random_uuid(), 'test_demo_layer', 99)
            """),
        )
        version_before = await _scalar(
            session, "SELECT version FROM workspace_meta",
        )
        repository = DemoRepository(session)

        await repository.replace_workspace_with_klaserie(str(admin_id))
        snapshot = await repository.replace_workspace_with_klaserie(
            str(admin_id),
        )

        assert await _scalar(
            session,
            "SELECT COUNT(*) FROM workspace_layers "
            "WHERE name = 'test_demo_layer'",
        ) == 0
        assert await _scalar(
            session, "SELECT COUNT(*) FROM workspace_layers",
        ) == _KLASERIE_LAYER_COUNT
        assert await _scalar(
            session,
            "SELECT COUNT(*) FROM workspace_features "
            "WHERE name = 'Klaserie HQ'",
        ) == 1
        meta = (
            await session.execute(
                text("SELECT version, updated_by FROM workspace_meta"),
            )
        ).one()
        assert meta.version == version_before + 2
        assert meta.updated_by == admin_id
        assert len(snapshot["features"]) == _KLASERIE_FEATURE_COUNT


def _client() -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    )


async def _user_id(session, username: str) -> str:
    return str(
        await _scalar(
            session,
            "SELECT id FROM users WHERE username = :u",
            {"u": username},
        ),
    )


@asynccontextmanager
async def _app_on_rolled_back_session():
    async with _rolled_back_session() as session:
        async def _get_db():
            yield session

        app.dependency_overrides[get_db] = _get_db
        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_reset_endpoint_requires_auth():
    async with _client() as client:
        response = await client.post("/v1/demo/reset")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_reset_endpoint_rejects_non_admin():
    async with _app_on_rolled_back_session() as session:
        ranger_id = await _user_id(session, "ranger1")
        async with _client() as client:
            response = await client.post(
                "/v1/demo/reset",
                headers={
                    "Authorization": f"Bearer {create_access_token(ranger_id)}",
                },
            )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_reset_endpoint_runs_reset_for_admin():
    async with _app_on_rolled_back_session() as session:
        admin_id = await _user_id(session, "admin1")
        with patch("app.api.v1.demo.DemoService") as service_cls:
            service_cls.return_value.reset = AsyncMock()
            async with _client() as client:
                response = await client.post(
                    "/v1/demo/reset",
                    headers={
                        "Authorization": (
                            f"Bearer {create_access_token(admin_id)}"
                        ),
                    },
                )
    assert response.status_code == 204
    service_cls.return_value.reset.assert_awaited_once()


@pytest.mark.asyncio
async def test_klaserie_endpoint_rejects_non_admin():
    async with _app_on_rolled_back_session() as session:
        analyst_id = await _user_id(session, "analyst1")
        async with _client() as client:
            response = await client.post(
                "/v1/demo/workspace/klaserie",
                headers={
                    "Authorization": (
                        f"Bearer {create_access_token(analyst_id)}"
                    ),
                },
            )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_klaserie_endpoint_runs_insert_for_admin():
    async with _app_on_rolled_back_session() as session:
        admin_id = await _user_id(session, "admin1")
        with patch("app.api.v1.demo.DemoService") as service_cls:
            service_cls.return_value.insert_klaserie_workspace = AsyncMock()
            async with _client() as client:
                response = await client.post(
                    "/v1/demo/workspace/klaserie",
                    headers={
                        "Authorization": (
                            f"Bearer {create_access_token(admin_id)}"
                        ),
                    },
                )
    assert response.status_code == 204
    service_cls.return_value.insert_klaserie_workspace.assert_awaited_once()


async def _insert_second_admin(session) -> str:
    return str(
        await _scalar(
            session,
            """
            INSERT INTO users
                (username, email, password_hash, first_name, last_name,
                 role, is_active)
            VALUES
                ('test_demo_admin2', 'test_demo_admin2@savanna.test',
                 :pw_hash, 'Second', 'Admin', 'admin', TRUE)
            RETURNING id
            """,
            {"pw_hash": get_password_hash("SecurePass1!")},
        ),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path", ["/v1/demo/reset", "/v1/demo/workspace/klaserie"],
)
async def test_demo_endpoints_reject_other_admins(path):
    async with _app_on_rolled_back_session() as session:
        admin_id = await _insert_second_admin(session)
        with patch("app.api.v1.demo.DemoService") as service_cls:
            async with _client() as client:
                response = await client.post(
                    path,
                    headers={
                        "Authorization": (
                            f"Bearer {create_access_token(admin_id)}"
                        ),
                    },
                )
    assert response.status_code == 403
    service_cls.assert_not_called()
