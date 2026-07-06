from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class LocationResponse(BaseModel):
    type: str
    coordinates: list[float]


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    submitted_by: str
    route_id: Optional[str] = None
    report_type: str
    description: str
    location: LocationResponse
    occurred_at: datetime
    created_at: datetime
    updated_at: datetime
    images: list[str] = []


class LocationLatLon(BaseModel):
    lat: float
    lon: float


class ReportListItem(BaseModel):
    report_id: str
    report_type: str
    location: LocationLatLon
    occurred_at: datetime
    description: str
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    species: Optional[str] = None
    count: Optional[int] = None
    images: list[str] = []
    route_id: Optional[str] = None
    sync_status: str
    submitted_by: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class ReportListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ReportListItem]


class ReportCreate(BaseModel):
    report_type: Literal["incident", "sighting"]
    location: LocationLatLon
    occurred_at: datetime
    description: str
    incident_type: Optional[str] = None
    severity: Optional[Literal["low", "medium", "high"]] = None
    species: Optional[str] = None
    count: Optional[int] = None
    images: list[str] = []
    route_id: Optional[str] = None
    sync_status: Optional[Literal["offline", "pending", "synced"]] = None


class ReportSubmitResponse(BaseModel):
    report_id: str
    report_type: str
    status: str
    submitted_by: str
    created_at: datetime
