from __future__ import annotations

from datetime import datetime  # noqa: TC003
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class _Base(DeclarativeBase):
    pass


class TerrainCellEffect(_Base):
    __tablename__ = "terrain_cell_effects"

    cell_ref: Mapped[str] = mapped_column(Text, primary_key=True)
    risk_delta: Mapped[float] = mapped_column(Float, nullable=False)
    route_multiplier: Mapped[float] = mapped_column(Float, nullable=False)


class TerrainEffectsMeta(_Base):
    __tablename__ = "terrain_effects_meta"

    id: Mapped[bool] = mapped_column(Boolean, primary_key=True, default=True)
    requested_hash: Mapped[str] = mapped_column(Text, nullable=False)
    computed_hash: Mapped[str] = mapped_column(Text, nullable=False)
    computed_version: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    computed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
