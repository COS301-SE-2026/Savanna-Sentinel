"""Schemas for batch sync."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.report import ReportCreate

SyncStatus = Literal["created", "updated", "deleted", "conflict", "error"]


class SyncReportItem(ReportCreate):
    """One queued report."""

    local_id: str
    deleted_at: Optional[datetime] = None


class SyncResultItem(BaseModel):
    local_id: str
    report_id: Optional[str] = None
    status: SyncStatus
    message: Optional[str] = None


class SyncResponse(BaseModel):
    results: list[SyncResultItem]
