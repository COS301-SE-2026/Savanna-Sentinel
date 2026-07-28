from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    jti: Mapped[object] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    issued_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    expires_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    revoked_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
