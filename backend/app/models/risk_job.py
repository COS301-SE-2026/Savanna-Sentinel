from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base

_UUID_COLUMN = UUID(as_uuid=False).with_variant(String(36), "sqlite")


class RiskJob(Base):
    __tablename__ = "risk_jobs"

    id: Mapped[str] = mapped_column(_UUID_COLUMN, primary_key=True)
    job_type: Mapped[str] = mapped_column(
        Enum("train", "score", name="risk_job_type"),
        nullable=False,
    )
    park_id: Mapped[str] = mapped_column(Text, nullable=False)
    triggered_by: Mapped[str] = mapped_column(
        _UUID_COLUMN,
        ForeignKey("users.id"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
