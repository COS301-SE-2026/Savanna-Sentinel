from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.repositories.ingestion_repository import IngestionRepository
from app.schemas.ingestion import CSVSchema, IngestionRequest
from app.services.audit_service import AuditService

if TYPE_CHECKING:
    from app.services.notification_service import NotificationService


class IngestionService:
    def __init__(
        self,
        repo: IngestionRepository,
        audit_service: AuditService | None = None,
        notification_service: "NotificationService | None" = None,
    ):
        self.repo = repo
        self.audit_service = audit_service
        self.notification_service = notification_service

    async def upload(self, body: IngestionRequest, actor_id: str | None = None):
        # Raises an exception if there is an error during validation
        response_data = self.validate(body)

        records = [
            record.model_dump() if hasattr(record, "model_dump") else record
            for record in body.records
        ]
        await self.repo.upload_file(records)

        if self.audit_service and actor_id:
            await self.audit_service.log(
                actor_id=actor_id,
                action="ingestion.csv_uploaded",
                target_type="ingestion",
                details=self._audit_details(body, len(records)),
            )

        if self.notification_service and actor_id:
            await self.notification_service.notify_user(
                actor_id,
                "ingestion_complete",
                "CSV ingestion complete",
                f"{len(records)} records from "
                f"{body.filename or 'your upload'} were ingested.",
                related_type="ingestion",
            )

        return response_data

    def _audit_details(self, body: IngestionRequest, record_count: int) -> dict:
        details = {
            "record_count": record_count,
            "start_row": body.start_row,
            "end_row": body.start_row + record_count - 1,
        }
        if body.filename:
            details["filename"] = body.filename
        return details

    def validate(self, body: IngestionRequest):
        validation_errors = {}
        for index, record in enumerate(body.records):
            try:
                record_data = (
                    record.model_dump()
                    if hasattr(record, "model_dump")
                    else record
                )
                CSVSchema(**record_data)
            except ValidationError as e:
                row_failures = []
                for error in e.errors():
                    column = error["loc"][0] if error["loc"] else "unknown"

                    row_failures.append(
                        {
                            "column": column,
                            "error_type": error["type"],
                            "message": error["msg"],
                        },
                    )
                validation_errors[f"row_{index + 1}"] = row_failures
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "message": "Validation failed for some records"
                    " on this batch, please correct and reupload",
                    "errors": validation_errors,
                },
            )
        return {
            "status": "success",
            "message": (
                f"All records validated from rows "
                f"{body.start_row} to {body.start_row + len(body.records) - 1}"
            ),
        }
