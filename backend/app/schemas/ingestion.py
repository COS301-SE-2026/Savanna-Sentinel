from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class IngestionUploadResponse(BaseModel):
    status: str
    message: str


class CSVSchema(BaseModel):
    submitted_by: str
    report_type: Literal["incident", "sighting"]
    description: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    occurred_at: datetime

    incident_type: Optional[str] = None
    severity: Optional[Literal["low", "medium", "high"]] = None

    species: Optional[str] = None
    count: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def check_type_specific_fields(self) -> "CSVSchema":
        if self.report_type == "incident":
            if not self.incident_type or not self.severity:
                raise ValueError(
                    "incident_type and severity are required when "
                    "report_type is 'incident'",
                )
            if self.species or self.count:
                raise ValueError(
                    "species and count must be empty when "
                    "report_type is 'incident'",
                )
        else:
            if not self.species or not self.count:
                raise ValueError(
                    "species and count are required when "
                    "report_type is 'sighting'",
                )
            if self.incident_type or self.severity:
                raise ValueError(
                    "incident_type and severity must be empty when "
                    "report_type is 'sighting'",
                )
        return self


class IngestionRequest(BaseModel):
    records: List[CSVSchema]
    start_row: int
    filename: Optional[str] = None
