import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import ARRAY, UUID, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    report_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("field_reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(String)
    photo_urls: Mapped[List[str]] = mapped_column(ARRAY(String))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    status_change: Mapped[Optional[str]] = mapped_column(String, nullable=True)
