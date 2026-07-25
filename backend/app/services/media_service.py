from __future__ import annotations

import uuid

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from app.core.config import settings

_UPLOAD_URL_EXPIRY_SECONDS = 300
_BOTO_CONFIG = BotoConfig(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
    connect_timeout=2,
    read_timeout=3,
    retries={"max_attempts": 0},
)


def _object_extension(content_type: str) -> str:
    subtype = content_type.split("/", 1)[1].lower()
    if subtype == "jpeg":
        subtype = "jpg"
    return f".{subtype}"


class MediaService:
    def __init__(self) -> None:
        self._internal_client = self._build_client(settings.MINIO_ENDPOINT)
        self._public_client = self._build_client(settings.MINIO_PUBLIC_ENDPOINT)

    @staticmethod
    def _build_client(endpoint: str):
        scheme = "https" if settings.MINIO_USE_SSL else "http"
        return boto3.client(
            "s3",
            endpoint_url=f"{scheme}://{endpoint}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=_BOTO_CONFIG,
            region_name=settings.MINIO_REGION,
        )

    def _ensure_bucket(self) -> None:
        try:
            self._internal_client.head_bucket(Bucket=settings.MINIO_BUCKET)
        except ClientError:
            try:
                self._internal_client.create_bucket(
                    Bucket=settings.MINIO_BUCKET,
                )
            except (ClientError, BotoCoreError):
                pass
        except BotoCoreError:
            pass

    def generate_upload_url(self, file_name: str, content_type: str) -> dict:
        if not file_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="file_name is required",
            )

        is_image = (
            content_type.startswith("image/")
            and len(
                content_type.split("/", 1)[1],
            )
            > 0
        )
        if not is_image:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="content_type must be a valid image MIME type",
            )

        self._ensure_bucket()

        object_key = f"reports/{uuid.uuid4()}{_object_extension(content_type)}"

        upload_url = self._public_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.MINIO_BUCKET,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=_UPLOAD_URL_EXPIRY_SECONDS,
        )

        scheme = "https" if settings.MINIO_USE_SSL else "http"
        object_url = (
            f"{scheme}://{settings.MINIO_PUBLIC_ENDPOINT}/"
            f"{settings.MINIO_BUCKET}/{object_key}"
        )

        return {
            "upload_url": upload_url,
            "object_url": object_url,
            "expires_in": _UPLOAD_URL_EXPIRY_SECONDS,
        }
