from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base

# actor_id/target_id are real, FK-validated UUIDs on Postgres. Under the
# sqlite dialect (in-memory DB used by unit tests) they fall back to a plain
# String so those tests can use arbitrary id strings without needing to
# satisfy UUID formatting or referential integrity.
_UUID_COLUMN = UUID(as_uuid=False).with_variant(String(36), "sqlite")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    actor_id: Mapped[str | None] = mapped_column(
        _UUID_COLUMN,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    target_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_id: Mapped[str | None] = mapped_column(
        _UUID_COLUMN, nullable=True,
    )
    details: Mapped[dict | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )