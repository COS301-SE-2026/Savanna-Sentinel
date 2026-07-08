from fastapi import HTTPException, status
from pydantic import ValidationError

from app.repositories.ingestion_repository import IngestionRepository
from app.schemas.ingestion import CSVSchema, IngestionRequest


class IngestionService:
    def __init__ (self, repo: IngestionRepository):
        self.repo = repo
    def validate (self, body: IngestionRequest):
        validation_errors = {}
        for index, record in enumerate(body.records):
            try:
                CSVSchema(**record.model_dump())
            except ValidationError as e:
                row_failures = []
                for error in e.errors():
                    column = error["loc"][0] if error["loc"] else "unknown"

                    row_failures.append({
                        "column": column,
                        "error_type": error["type"],
                        "message": error["msg"],
                    })
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
        return{
            "status": "success",
            "message": (
                f"All records validated from rows "
                f"{body.start_row} to {body.start_row + len(body.records) - 1}"
            ),
        }

