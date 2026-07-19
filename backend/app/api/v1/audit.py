from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditLogFilterRequest, AuditLogListResponse
from app.services.audit_service import AuditService

router = APIRouter(tags=["audit"])

@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="List audit log entries",
)
async def list_audit_logs(
        req: Annotated[AuditLogFilterRequest, Depends()],
        db: Annotated[AsyncSession, Depends(get_db)],
        current_admin: Annotated[User, Depends(require_roles(["admin"]))],
    ):
    service = AuditService(AuditRepository(db))
    return await service.get_logs(req)
