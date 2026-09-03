from __future__ import annotations

import uuid

import boto3
from botocore.client import Config as BotoConfig

from app.core.config import settings

_BOTO_CONFIG = BotoConfig(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
    connect_timeout=2,
    read_timeout=10,
    retries={"max_attempts": 0},
)


class RiskModelStorage:
    def __init__(self) -> None:
        self._client = self._build_client()

    @staticmethod
    def _build_client():
        scheme = "https" if settings.MINIO_INTERNAL_USE_SSL else "http"
        return boto3.client(
            "s3",
            endpoint_url=f"{scheme}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=_BOTO_CONFIG,
            region_name=settings.MINIO_REGION,
        )

    def upload_model(self, park_id: str, model_bytes: bytes) -> str:
        object_key = f"risk-models/{park_id}/{uuid.uuid4()}.json"
        self._client.put_object(
            Bucket=settings.MINIO_BUCKET,
            Key=object_key,
            Body=model_bytes,
            ContentType="application/json",
        )
        return object_key

    def download_model(self, object_key: str) -> bytes:
        response = self._client.get_object(
            Bucket=settings.MINIO_BUCKET,
            Key=object_key,
        )
        return response["Body"].read()

    def delete_model(self, object_key: str) -> None:
        self._client.delete_object(
            Bucket=settings.MINIO_BUCKET,
            Key=object_key,
        )
