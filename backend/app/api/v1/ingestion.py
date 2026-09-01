from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.ingestion_repository import IngestionRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.ingestion import IngestionRequest, IngestionUploadResponse
from app.services.audit_service import AuditService
from app.services.ingestion_service import IngestionService
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post(
    "/upload",
    response_model=IngestionUploadResponse,
    summary="Validate and upload a received json object",
)
async def upload_file(
    body: IngestionRequest,
    db: Annotated[
        AsyncSession,
        Depends(get_db),
    ],
    current_user: Annotated[
        User,
        Depends(require_roles(["admin", "analyst"])),
    ],
):
    repo = IngestionRepository(db)
    service = IngestionService(
        repo,
        AuditService(AuditRepository(db)),
        notification_service=NotificationService(
            NotificationRepository(db),
            UserRepository(db),
        ),
    )

    return await service.upload(body, actor_id=current_user.id)
