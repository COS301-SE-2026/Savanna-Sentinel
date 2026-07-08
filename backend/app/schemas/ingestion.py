from datetime import datetime
from typing import List

from pydantic import BaseModel


class IngestionUploadResponse(BaseModel):
    upload_id: str
    status: str
    queued_at: datetime

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
