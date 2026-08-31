from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import insert, text

from app.models.notification import Notification

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_for_users(
        self,
        user_ids: list[str],
        type: str,
        title: str,
        body: str,
        related_type: Optional[str] = None,
        related_id: Optional[str] = None,
    ) -> None:
        if not user_ids:
            return

        rows = [
            {
                "user_id": user_id,
                "type": type,
                "title": title,
                "body": body,
                "related_type": related_type,
                "related_id": related_id,
            }
            for user_id in user_ids
        ]
        await self.db.execute(insert(Notification), rows)
        await self.db.commit()

    async def list_for_user(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int, int]:
        total = (
            await self.db.execute(
                text(
                    "SELECT COUNT(*) FROM notifications WHERE user_id = :user_id",
                ),
                {"user_id": user_id},
            )
        ).scalar() or 0

        unread_count = (
            await self.db.execute(
                text(
                    "SELECT COUNT(*) FROM notifications "
                    "WHERE user_id = :user_id AND read_at IS NULL",
                ),
                {"user_id": user_id},
            )
        ).scalar() or 0

        rows = (
            await self.db.execute(
                text("""
                    SELECT
                        id::text AS id,
                        type::text AS type,
                        title,
                        body,
                        (read_at IS NOT NULL) AS read,
                        related_type,
                        related_id,
                        created_at
                    FROM notifications
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT :limit OFFSET :offset
                """, # nosec B608
                ),
                {
                    "user_id": user_id,
                    "limit": page_size,
                    "offset": (page - 1) * page_size,
                },
            )
        ).mappings().all()

        return [dict(row) for row in rows], total, unread_count

    async def mark_read(self, user_id: str, notification_id: str) -> bool:
        result = await self.db.execute(
            text("""
                UPDATE notifications
                SET read_at = NOW()
                WHERE id = :id AND user_id = :user_id AND read_at IS NULL
            """),
            {"id": notification_id, "user_id": user_id},
        )
        await self.db.commit()
        return result.rowcount > 0

    async def mark_all_read(self, user_id: str) -> None:
        await self.db.execute(
            text("""
                UPDATE notifications
                SET read_at = NOW()
                WHERE user_id = :user_id AND read_at IS NULL
            """),
            {"user_id": user_id},
        )
        await self.db.commit()
