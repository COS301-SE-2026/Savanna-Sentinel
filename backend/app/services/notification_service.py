from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException, status

if TYPE_CHECKING:
    from app.models.user import User
    from app.repositories.notification_repository import NotificationRepository
    from app.repositories.user_repository import UserRepository
    from app.schemas.notification import NotificationType


class NotificationService:
    def __init__(
        self,
        repo: "NotificationRepository",
        user_repo: "UserRepository",
    ):
        self.repo = repo
        self.user_repo = user_repo

    async def get_notifications(
        self,
        current_user: "User",
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int, int]:
        return await self.repo.list_for_user(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
        )

    async def mark_read(
        self,
        current_user: "User",
        notification_id: str,
    ) -> None:
        updated = await self.repo.mark_read(current_user.id, notification_id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

    async def mark_all_read(self, current_user: "User") -> None:
        await self.repo.mark_all_read(current_user.id)

    async def notify_roles(
        self,
        roles: list[str],
        type: "NotificationType",
        title: str,
        body: str,
        related_type: Optional[str] = None,
        related_id: Optional[str] = None,
    ) -> None:
        user_ids = await self.user_repo.get_ids_by_roles(roles)
        await self.repo.create_for_users(
            user_ids=user_ids,
            type=type,
            title=title,
            body=body,
            related_type=related_type,
            related_id=related_id,
        )

    async def notify_user(
        self,
        user_id: str,
        type: "NotificationType",
        title: str,
        body: str,
        related_type: Optional[str] = None,
        related_id: Optional[str] = None,
    ) -> None:
        await self.repo.create_for_users(
            user_ids=[user_id],
            type=type,
            title=title,
            body=body,
            related_type=related_type,
            related_id=related_id,
        )
