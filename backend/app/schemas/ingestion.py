from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class IngestionUploadResponse(BaseModel):
    status: str
    message: str


class CSVSchema(BaseModel):
    record_id: int
    ingestion_timestamp: datetime
    source_system: str
    data_domain: str
    event_type: str
    payload_size_kb: int
    priority_level: str
    retry_count: int
    is_encrypted: bool
    status: str


class IngestionRequest(BaseModel):
    records: List[CSVSchema]
    start_row: int
    filename: Optional[str] = None
