from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.schemas.ingestion import IngestionRequest
from app.services.ingestion_service import IngestionService


@pytest.fixture
def fake_ranger():
    user = MagicMock()
    user.id = "user-1"
    user.role = "ranger"
    return user


def _make_repo(submitter):
    repo = AsyncMock()
    repo.users.get_by_username = AsyncMock(return_value=submitter)
    return repo


@pytest.fixture
def mock_repo(fake_ranger):
    return _make_repo(fake_ranger)


@pytest.fixture
def service(mock_repo):
    return IngestionService(repo=mock_repo)


@pytest.fixture
def mock_audit():
    return AsyncMock()


@pytest.fixture
def auditing_service(mock_audit, fake_ranger):
    repo = _make_repo(fake_ranger)
    return IngestionService(repo=repo, audit_service=mock_audit)


@pytest.fixture
def valid_body():
    return {
        "start_row": 1,
        "records": [
            {
                "submitted_by": "ranger1",
                "report_type": "incident",
                "description": "Snare found near the river bend.",
                "lat": -24.1,
                "lon": 31.05,
                "occurred_at": "2026-03-15T08:30:00Z",
                "incident_type": "Snare Found",
                "severity": "high",
            },
        ],
    }


@pytest.fixture
def invalid_body():
    return {
        "start_row": 1,
        "records": [
            {
                "submitted_by": "ranger1",
                "report_type": "incident",
                "description": "Snare found near the river bend.",
                "lat": "not-a-number",
                "lon": 31.05,
                "occurred_at": "not-a-date",
                "incident_type": "Snare Found",
                "severity": "high",
            },
        ],
    }


@pytest.mark.asyncio
async def test_ingestion_service_validate_success(service, valid_body):
    body = IngestionRequest(**valid_body)

    result = await service.validate(body)

    assert result["status"] == "success"
    assert "rows 1 to 1" in result["message"]


@pytest.mark.asyncio
async def test_ingestion_service_validate_failure(service, invalid_body):
    # Force data into the model, ignoring pydantic errors
    body = IngestionRequest.model_construct(
        start_row=invalid_body["start_row"],
        records=invalid_body["records"],
    )

    with pytest.raises(HTTPException) as e:
        await service.validate(body)

    assert e.value.status_code == 422
    assert e.value.detail["message"] == (
        "Validation failed for some records"
        " on this batch, please correct and reupload"
    )

    errors = e.value.detail["errors"]["row_1"]
    failed_cols = [err["column"] for err in errors]
    assert "lat" in failed_cols
    assert "occurred_at" in failed_cols


@pytest.mark.asyncio
async def test_ingestion_service_validate_rejects_unknown_submitter(
    service,
    mock_repo,
    valid_body,
):
    mock_repo.users.get_by_username = AsyncMock(return_value=None)
    body = IngestionRequest(**valid_body)

    with pytest.raises(HTTPException) as e:
        await service.validate(body)

    errors = e.value.detail["errors"]["row_1"]
    assert errors[0]["column"] == "submitted_by"


@pytest.mark.asyncio
async def test_ingestion_service_validate_rejects_wrong_role_submitter(
    service,
    mock_repo,
    valid_body,
):
    analyst = MagicMock(id="user-2", role="analyst")
    mock_repo.users.get_by_username = AsyncMock(return_value=analyst)
    body = IngestionRequest(**valid_body)

    with pytest.raises(HTTPException) as e:
        await service.validate(body)

    errors = e.value.detail["errors"]["row_1"]
    assert errors[0]["column"] == "submitted_by"


@pytest.mark.asyncio
async def test_upload_writes_audit_entry(
    auditing_service,
    mock_audit,
    valid_body,
):
    body = IngestionRequest(**{**valid_body, "filename": "march_data.csv"})

    await auditing_service.upload(body, actor_id="actor-1")

    mock_audit.log.assert_awaited_once()
    kwargs = mock_audit.log.call_args.kwargs
    assert kwargs["actor_id"] == "actor-1"
    assert kwargs["action"] == "ingestion.csv_uploaded"
    assert kwargs["target_type"] == "ingestion"
    assert kwargs["details"] == {
        "record_count": 1,
        "start_row": 1,
        "end_row": 1,
        "filename": "march_data.csv",
    }


@pytest.mark.asyncio
async def test_upload_audit_details_omit_missing_filename(
    auditing_service,
    mock_audit,
    valid_body,
):
    await auditing_service.upload(
        IngestionRequest(**valid_body),
        actor_id="actor-1",
    )

    assert "filename" not in mock_audit.log.call_args.kwargs["details"]


@pytest.mark.asyncio
async def test_upload_skips_audit_without_actor(
    auditing_service,
    mock_audit,
    valid_body,
):
    await auditing_service.upload(IngestionRequest(**valid_body))

    mock_audit.log.assert_not_awaited()


@pytest.mark.asyncio
async def test_upload_does_not_audit_invalid_batch(
    auditing_service,
    mock_audit,
    invalid_body,
):
    body = IngestionRequest.model_construct(
        start_row=invalid_body["start_row"],
        records=invalid_body["records"],
        filename=None,
    )

    with pytest.raises(HTTPException):
        await auditing_service.upload(body, actor_id="actor-1")

    mock_audit.log.assert_not_awaited()
    auditing_service.repo.upload_file.assert_not_awaited()


@pytest.mark.asyncio
async def test_upload_persists_records(auditing_service, valid_body):
    await auditing_service.upload(
        IngestionRequest(**valid_body),
        actor_id="actor-1",
    )

    records = auditing_service.repo.upload_file.call_args.args[0]
    assert len(records) == 1
    assert records[0]["submitted_by"] == "ranger1"


# notifications


@pytest.fixture
def notification_service():
    return AsyncMock()


@pytest.fixture
def notifying_service(notification_service, fake_ranger):
    repo = _make_repo(fake_ranger)
    return IngestionService(
        repo=repo,
        notification_service=notification_service,
    )


@pytest.mark.asyncio
async def test_upload_without_notification_service_does_not_error(
    auditing_service,
    valid_body,
):
    await auditing_service.upload(
        IngestionRequest(**valid_body),
        actor_id="actor-1",
    )


@pytest.mark.asyncio
async def test_upload_notifies_the_uploading_actor(
    notifying_service,
    notification_service,
    valid_body,
):
    await notifying_service.upload(
        IngestionRequest(**{**valid_body, "filename": "march_data.csv"}),
        actor_id="actor-1",
    )

    notification_service.notify_user.assert_awaited_once()
    args = notification_service.notify_user.call_args.args
    assert args[0] == "actor-1"
    assert args[1] == "ingestion_complete"
    assert "march_data.csv" in args[3]


@pytest.mark.asyncio
async def test_upload_skips_notification_without_actor(
    notifying_service,
    notification_service,
    valid_body,
):
    await notifying_service.upload(IngestionRequest(**valid_body))

    notification_service.notify_user.assert_not_awaited()
