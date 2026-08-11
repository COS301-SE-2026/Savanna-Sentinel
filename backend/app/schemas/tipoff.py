from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.report import LocationLatLon


class TipoffCreate(BaseModel):
    report_type: Literal["incident", "sighting"]
    location: LocationLatLon
    occurred_at: datetime
    description: str
    incident_type: Optional[str] = None
    severity: Optional[Literal["low", "medium", "high"]] = None
    species: Optional[str] = None
    count: Optional[int] = None
    images: list[str] = []


class TipoffSubmitResponse(BaseModel):
    tipoff_id: str
    report_type: str
    status: str
    submitted_by: str
    created_at: datetime


class TipoffListItem(BaseModel):
    tipoff_id: str
    report_type: str
    location: LocationLatLon
    occurred_at: datetime
    description: str
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    species: Optional[str] = None
    count: Optional[int] = None
    images: list[str] = []
    submitted_by: str
    created_at: datetime


class TipoffListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[TipoffListItem]
