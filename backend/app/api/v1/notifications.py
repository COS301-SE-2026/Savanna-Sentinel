from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.notification import NotificationItem, NotificationListResponse
from app.services.notification_service import NotificationService

router = APIRouter(tags=["notifications"])


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List the current user's notifications",
)
async def list_notifications(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = NotificationService(
        NotificationRepository(db),
        UserRepository(db),
    )
    results, total, unread_count = await service.get_notifications(
        current_user=current_user,
        page=page,
        page_size=page_size,
    )

    return NotificationListResponse(
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        results=[NotificationItem(**item) for item in results],
    )


@router.post(
    "/notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all of the current user's notifications as read",
)
async def mark_all_notifications_read(
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = NotificationService(
        NotificationRepository(db),
        UserRepository(db),
    )
    await service.mark_all_read(current_user)


@router.post(
    "/notifications/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark a single notification as read",
)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = NotificationService(
        NotificationRepository(db),
        UserRepository(db),
    )
    await service.mark_read(current_user, notification_id)
