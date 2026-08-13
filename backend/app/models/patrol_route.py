from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import UserDefinedType

from app.models.user import Base


class GeographyPoint(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kw):
        return "GEOGRAPHY(Point, 4326)"


class GeographyLineString(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kw):
        return "GEOGRAPHY(LineString, 4326)"


class PatrolRoute(Base):
    __tablename__ = "patrol_routes"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    request_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    requested_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False,
    )
    start_point: Mapped[str] = mapped_column(GeographyPoint, nullable=False)
    end_point: Mapped[str] = mapped_column(GeographyPoint, nullable=False)
    max_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_fuel: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_path: Mapped[str] = mapped_column(GeographyLineString, nullable=False)
    estimated_time: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_fuel: Mapped[float] = mapped_column(Float, nullable=False)
    risk_coverage: Mapped[float] = mapped_column(Float, nullable=False)
    risk_heatmap: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
    )
