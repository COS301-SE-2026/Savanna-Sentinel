from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.schemas.ingestion import IngestionRequest
from app.services.ingestion_service import IngestionService


@pytest.fixture
def mock_repo():
    return MagicMock()

@pytest.fixture
def service(mock_repo):
    return IngestionService(repo=mock_repo)

@pytest.fixture
def valid_body():
    return {
        "start_row": 1,
        "records": [
            {
                "record_id": 1,
                "ingestion_timestamp": "2026-03-15T08:30:00Z",
                "source_system": "ERP",
                "data_domain": "Finance",
                "event_type": "Invoice",
                "payload_size_kb": 100,
                "priority_level": "HIGH",
                "retry_count": 0,
                "is_encrypted": True,
                "status": "PENDING",
            },
        ],
    }

@pytest.fixture
def invalid_body():
    return {
        "start_row": 1,
        "records" : [
            {
                "record_id": "some_string_that is not an int",
                "ingestion_timestamp": "2026-03-15T08:30:00Z",
                "source_system": "ERP",
                "data_domain": "Finance",
                "event_type": "Invoice",
                "payload_size_kb": 100,
                "priority_level": "HIGH",
                "retry_count": 0,
                "is_encrypted": "false string",
                "status": "PENDING",
            },
        ],
    }

def test_ingestion_service_validate_success(service, valid_body):
    body = IngestionRequest(**valid_body)

    result = service.validate(body)

    assert result["status"] == "success"
    assert "rows 1 to 1" in result["message"]

def test_ingestion_service_validate_failure(service, invalid_body):
    # Force data into the model, ignoring pydantic errors
    body = IngestionRequest.model_construct(
        start_row=invalid_body["start_row"],
        records=invalid_body["records"],
    )

    with pytest.raises(HTTPException) as e:
        service.validate(body)

    assert e.value.status_code == 422
    assert e.value.detail["message"] == (
        "Validation failed for some records"
        " on this batch, please correct and reupload"
    )

    errors = e.value.detail["errors"]["row_1"]
    failed_cols = [err["column"] for err in errors]
    assert "record_id" in failed_cols
    assert "is_encrypted" in failed_cols
