from __future__ import annotations

import uuid
from datetime import datetime  # noqa: TC003

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import UserDefinedType

from app.models.user import Base

_UUID_COLUMN = UUID(as_uuid=False).with_variant(String(36), "sqlite")
_JSONB_COLUMN = JSONB().with_variant(JSON(), "sqlite")

class GeographyPoint(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kw):
        return "GEOGRAPHY(Point, 4326)"

class GeographyLineString(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kw):
        return "GEOGRAPHY(LineString, 4326)"


_GEOGRAPHY_POINT_COLUMN = GeographyPoint().with_variant(Text(), "sqlite")
_GEOGRAPHY_LINESTRING_COLUMN = GeographyLineString().with_variant(
    Text(), "sqlite",
)

class PatrolRoute(Base):
    __tablename__ = "patrol_routes"

    id: Mapped[str] = mapped_column(
        _UUID_COLUMN, primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    request_id: Mapped[str] = mapped_column(_UUID_COLUMN, nullable=False)
    requested_by: Mapped[str] = mapped_column(
        _UUID_COLUMN, ForeignKey("users.id"), nullable=False,
    )
    start_point: Mapped[str] = mapped_column(
        _GEOGRAPHY_POINT_COLUMN, nullable=False,
    )
    end_point: Mapped[str] = mapped_column(
        _GEOGRAPHY_POINT_COLUMN, nullable=False,
    )
    max_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_fuel: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_path: Mapped[str] = mapped_column(
        _GEOGRAPHY_LINESTRING_COLUMN, nullable=False,
    )
    estimated_time: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_fuel: Mapped[float] = mapped_column(Float, nullable=False)
    risk_coverage: Mapped[float] = mapped_column(Float, nullable=False)
    risk_heatmap: Mapped[dict] = mapped_column(_JSONB_COLUMN, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
    )
