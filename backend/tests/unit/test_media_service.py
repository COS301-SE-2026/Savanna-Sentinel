from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError
from fastapi import HTTPException

import app.services.media_service as media_service


def _make_service(monkeypatch, client=None):
    fake_client = client or MagicMock()
    fake_client.generate_presigned_url.return_value = (
        "http://localhost:9000/savanna-sentinel-media/reports/fake.jpg"
        "?X-Amz-Signature=abc"
    )
    monkeypatch.setattr(
        media_service.boto3,
        "client",
        lambda *args, **kwargs: fake_client,
    )
    service = media_service.MediaService()
    return service, fake_client


def test_generate_upload_url_returns_expected_shape(monkeypatch):
    service, client = _make_service(monkeypatch)
    result = service.generate_upload_url("snare.jpg", "image/jpeg")

    assert result["expires_in"] == 300
    assert result["upload_url"] == client.generate_presigned_url.return_value
    assert result["object_url"].startswith(
        f"http://{media_service.settings.MINIO_PUBLIC_ENDPOINT}/"
        f"{media_service.settings.MINIO_BUCKET}/reports/",
    )
    assert result["object_url"].endswith(".jpg")


def test_generate_upload_url_calls_presign_with_correct_params(monkeypatch):
    service, client = _make_service(monkeypatch)
    service.generate_upload_url("snare.png", "image/png")

    kwargs = client.generate_presigned_url.call_args.kwargs
    assert kwargs["ClientMethod"] == "put_object"
    assert kwargs["Params"]["Bucket"] == media_service.settings.MINIO_BUCKET
    assert kwargs["Params"]["ContentType"] == "image/png"
    assert kwargs["Params"]["Key"].endswith(".png")
    assert kwargs["ExpiresIn"] == 300


def test_empty_file_name_raises_400(monkeypatch):
    service, _ = _make_service(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        service.generate_upload_url("   ", "image/jpeg")
    assert exc.value.status_code == 400


def test_non_image_content_type_raises_400(monkeypatch):
    service, _ = _make_service(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        service.generate_upload_url("virus.exe", "application/exe")
    assert exc.value.status_code == 400


def test_jpeg_extension_normalised_to_jpg(monkeypatch):
    service, _ = _make_service(monkeypatch)
    result = service.generate_upload_url("photo.jpeg", "image/jpeg")
    assert result["object_url"].endswith(".jpg")


def test_webp_extension_preserved(monkeypatch):
    service, _ = _make_service(monkeypatch)
    result = service.generate_upload_url("photo.webp", "image/webp")
    assert result["object_url"].endswith(".webp")


def test_ensure_bucket_creates_missing_bucket(monkeypatch):
    fake_client = MagicMock()
    fake_client.head_bucket.side_effect = ClientError(
        {"Error": {"Code": "404", "Message": "Not Found"}},
        "HeadBucket",
    )
    service, client = _make_service(monkeypatch, client=fake_client)
    service._ensure_bucket()

    service.generate_upload_url("snare.jpg", "image/jpeg")

    client.create_bucket.assert_called_once_with(
        Bucket=media_service.settings.MINIO_BUCKET,
    )


def test_ensure_bucket_swallows_connection_errors(monkeypatch):
    fake_client = MagicMock()
    fake_client.head_bucket.side_effect = media_service.BotoCoreError()
    service, _ = _make_service(monkeypatch, client=fake_client)

    result = service.generate_upload_url("snare.jpg", "image/jpeg")

    assert "upload_url" in result


def test_generate_view_url_signs_stored_object_url(monkeypatch):
    service, client = _make_service(monkeypatch)
    client.generate_presigned_url.return_value = "http://signed/view"
    bucket = media_service.settings.MINIO_BUCKET
    stored_url = f"http://minio:9000/{bucket}/reports/abc.jpg"

    result = service.generate_view_url(stored_url)

    assert result == "http://signed/view"
    kwargs = client.generate_presigned_url.call_args.kwargs
    assert kwargs["ClientMethod"] == "get_object"
    assert kwargs["Params"]["Bucket"] == bucket
    assert kwargs["Params"]["Key"] == "reports/abc.jpg"
    assert kwargs["ExpiresIn"] == 900


def test_generate_view_url_returns_unrecognised_url_unchanged(monkeypatch):
    service, _ = _make_service(monkeypatch)
    odd_url = "http://example.com/not-a-minio-url.jpg"

    assert service.generate_view_url(odd_url) == odd_url
