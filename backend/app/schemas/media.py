from pydantic import BaseModel, Field


class MediaUploadUrlRequest(BaseModel):
    file_name: str = Field(..., min_length=1)
    content_type: str = Field(..., min_length=1)


class MediaUploadUrlResponse(BaseModel):
    upload_url: str
    object_url: str
    expires_in: int
