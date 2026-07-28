from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.models.user import User
from app.repositories.ingestion_repository import IngestionRepository
from app.schemas.ingestion import IngestionRequest, IngestionUploadResponse
from app.services.ingestion_service import IngestionService

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
    is_authenticated: Annotated[
        User,
        Depends(require_roles(["admin", "analyst"])),
    ],
):
    repo = IngestionRepository(db)
    service = IngestionService(repo)

    # Raises an exception if there is an error during validation
    response_data = service.validate(body)

    records = [
        record.model_dump() if hasattr(record, "model_dump") else record
        for record in body.records
    ]
    # Currently stubbed since db functionality is not implemented
    await repo.upload_file(records)

    return response_data
