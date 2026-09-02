from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import require_roles
from app.models.user import User
from app.schemas.media import MediaUploadUrlRequest, MediaUploadUrlResponse
from app.services.media_service import MediaService

router = APIRouter(prefix="/media", tags=["media"])

_service = MediaService()


@router.post(
    "/upload-url",
    response_model=MediaUploadUrlResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a pre-signed MinIO upload URL",
)
def request_upload_url(
    body: MediaUploadUrlRequest,
    current_user: Annotated[
        User,
        Depends(require_roles(["ranger", "community_liaison", "admin"])),
    ],
):
    return _service.generate_upload_url(body.file_name, body.content_type)
