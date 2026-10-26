from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.workspace_repository import WorkspaceRepository

_SEED_DIR = Path(__file__).resolve().parents[2] / "init-db"
_SEED_FILES = ("02_seed.sql",)
_KLASERIE_WORKSPACE_FILE = "04_seed_workspace_layers.sql"


class DemoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def reset_database(self, preserved_username: str) -> None:
        await self.db.execute(text("SET LOCAL lock_timeout = '10s'"))

        preserved_user = (
            await self.db.execute(
                text("SELECT * FROM users WHERE username = :username"),
                {"username": preserved_username},
            )
        ).mappings().first()
        preserved_tokens = []
        if preserved_user is not None:
            preserved_tokens = (
                await self.db.execute(
                    text("SELECT * FROM refresh_tokens WHERE user_id = :id"),
                    {"id": preserved_user["id"]},
                )
            ).mappings().all()

        tables = (
            await self.db.execute(
                text("""
                    SELECT quote_ident(tablename) FROM pg_tables
                    WHERE schemaname = 'public'
                      AND tablename <> 'spatial_ref_sys'
                """),
            )
        ).scalars().all()
        await self.db.execute(
            text(
                f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE",
            ),
        )
        await WorkspaceRepository(self.db).ensure_meta()

        for file_name in _SEED_FILES:
            await self._run_seed_file(file_name)

        if preserved_user is not None:
            await self._restore_user(preserved_user, preserved_tokens)

        await self.db.commit()

    async def replace_workspace_with_klaserie(
        self,
        user_id: str,
    ) -> dict[str, Any]:
        await self.db.execute(text("SET LOCAL lock_timeout = '10s'"))
        workspace = WorkspaceRepository(self.db)
        await workspace.bump_version(user_id)
        await self.db.execute(text("DELETE FROM workspace_features"))
        await self.db.execute(text("DELETE FROM workspace_layers"))
        await self._run_seed_file(_KLASERIE_WORKSPACE_FILE)
        await self.db.commit()
        return await workspace.load_snapshot()

    async def _run_seed_file(self, file_name: str) -> None:
        # The seed files hold many statements and DO blocks, which only the
        # driver's simple query protocol runs in one call.
        connection = await self.db.connection()
        raw_connection = await connection.get_raw_connection()
        await raw_connection.driver_connection.execute(
            (_SEED_DIR / file_name).read_text(),
        )

    async def _restore_user(self, user, tokens) -> None:
        await self.db.execute(
            text("""
                UPDATE users
                SET id = :id, email = :email, password_hash = :password_hash,
                    first_name = :first_name, last_name = :last_name,
                    role = :role, is_active = :is_active,
                    created_at = :created_at, deleted_at = :deleted_at
                WHERE username = :username
            """),
            dict(user),
        )
        for token in tokens:
            await self.db.execute(
                text("""
                    INSERT INTO refresh_tokens
                        (jti, user_id, issued_at, expires_at, revoked_at)
                    VALUES
                        (:jti, :user_id, :issued_at, :expires_at, :revoked_at)
                """),
                dict(token),
            )
