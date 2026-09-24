from __future__ import annotations

from datetime import datetime  # noqa: TC003
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class _Base(DeclarativeBase):
    pass


class WorkspaceMeta(_Base):
    __tablename__ = "workspace_meta"

    id: Mapped[bool] = mapped_column(Boolean, primary_key=True, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    updated_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id"),
        nullable=True,
    )


class WorkspaceLayer(_Base):
    __tablename__ = "workspace_layers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workspace_layers.id", ondelete="CASCADE"),
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    default_style: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )


class WorkspaceFeature(_Base):
    __tablename__ = "workspace_features"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    feature_type: Mapped[str] = mapped_column(
        Enum(
            "point",
            "line",
            "polygon",
            name="workspace_feature_type",
            create_type=False,
        ),
        nullable=False,
    )
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geometry: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )


class WorkspaceMembership(_Base):
    __tablename__ = "workspace_memberships"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    feature_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workspace_features.id", ondelete="CASCADE"),
        nullable=False,
    )
    layer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workspace_layers.id", ondelete="CASCADE"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    style_override: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )


class WorkspaceMembershipVisibility(_Base):
    __tablename__ = "workspace_membership_visibility"

    membership_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workspace_memberships.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False)
