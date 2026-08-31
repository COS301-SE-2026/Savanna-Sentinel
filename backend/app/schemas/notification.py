from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

NotificationType = Literal[
    "tipoff_submitted",
    "field_report_submitted",
    "high_severity_incident",
    "ingestion_complete",
]


class NotificationItem(BaseModel):
    id: str
    type: NotificationType
    title: str
    body: str
    read: bool
    related_type: Optional[str] = None
    related_id: Optional[str] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    page: int
    page_size: int
    results: list[NotificationItem]
