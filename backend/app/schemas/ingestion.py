from datetime import datetime


class IngestionUploadResponse:
    upload_id: str
    status: str
    queued_at: datetime
