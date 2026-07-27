from sqlalchemy import BigInteger, Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class FileIngestionStaging(Base):
    __tablename__ = "file_ingestion_staging"

    record_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ingestion_timestamp: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
    )
    source_system: Mapped[str] = mapped_column(String)
    data_domain: Mapped[str] = mapped_column(String)
    event_type: Mapped[str] = mapped_column(String)
    payload_size_kb: Mapped[float] = mapped_column(Numeric)
    priority_level: Mapped[str] = mapped_column(String)
    retry_count: Mapped[int] = mapped_column(Integer)
    is_encrypted: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String)
