import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import ARRAY, UUID, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Comment(Base):
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    report_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
    )
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
    )
    body: Mapped[str] = mapped_column(String)
    photo_urls: Mapped[List[str]] = mapped_column(ARRAY(String))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    status_change: Mapped[Optional[str]] = mapped_column(String, nullable=True)
