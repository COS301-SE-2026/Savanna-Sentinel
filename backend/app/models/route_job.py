from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base

_UUID_COLUMN = UUID(as_uuid=False).with_variant(String(36), "sqlite")


class RouteJob(Base):
    __tablename__ = "route_jobs"

    id: Mapped[str] = mapped_column(_UUID_COLUMN, primary_key=True)
    park_id: Mapped[str] = mapped_column(Text, nullable=False)
    requested_by: Mapped[str] = mapped_column(
        _UUID_COLUMN,
        ForeignKey("users.id"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
