from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor_id: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    details: dict | None = None
    created_at: datetime

class AuditLogListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[AuditLogResponse]

class AuditLogFilterRequest(BaseModel):
    actor_id: Optional[str] = None
    action: Optional[str] = None
    target_type: Optional[str] = None
    page: int = 1
    page_size: int = Field(default=20, le=100)
