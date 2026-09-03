from unittest.mock import MagicMock

import app.services.risk_model_storage as risk_model_storage


def _make_service(monkeypatch, client=None):
    fake_client = client or MagicMock()
    monkeypatch.setattr(
        risk_model_storage.boto3,
        "client",
        lambda *args, **kwargs: fake_client,
    )
    return risk_model_storage.RiskModelStorage(), fake_client


def test_upload_model_puts_object_under_risk_models_prefix(monkeypatch):
    service, client = _make_service(monkeypatch)

    key = service.upload_model("klaserie", b"model-bytes")

    assert key.startswith("risk-models/klaserie/")
    assert key.endswith(".json")
    client.put_object.assert_called_once()
    call_kwargs = client.put_object.call_args.kwargs
    assert call_kwargs["Bucket"] == risk_model_storage.settings.MINIO_BUCKET
    assert call_kwargs["Key"] == key
    assert call_kwargs["Body"] == b"model-bytes"


def test_download_model_gets_object_by_key(monkeypatch):
    fake_body = MagicMock()
    fake_body.read.return_value = b"model-bytes"
    fake_client = MagicMock()
    fake_client.get_object.return_value = {"Body": fake_body}
    service, client = _make_service(monkeypatch, client=fake_client)

    result = service.download_model("risk-models/klaserie/abc.json")

    assert result == b"model-bytes"
    client.get_object.assert_called_once_with(
        Bucket=risk_model_storage.settings.MINIO_BUCKET,
        Key="risk-models/klaserie/abc.json",
    )


def test_delete_model_deletes_object_by_key(monkeypatch):
    service, client = _make_service(monkeypatch)

    service.delete_model("risk-models/klaserie/abc.json")

    client.delete_object.assert_called_once_with(
        Bucket=risk_model_storage.settings.MINIO_BUCKET,
        Key="risk-models/klaserie/abc.json",
    )
