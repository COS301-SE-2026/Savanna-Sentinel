from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import bindparam, delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.workspace import (
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
    WorkspaceMembershipVisibility,
    WorkspaceMeta,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

_meta = WorkspaceMeta.__table__
_layers = WorkspaceLayer.__table__
_features = WorkspaceFeature.__table__
_memberships = WorkspaceMembership.__table__
_visibility = WorkspaceMembershipVisibility.__table__


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WorkspaceRepository:
    def __init__(self, db: "AsyncSession"):
        self.db = db

    async def _ensure_meta(self) -> None:
        await self.db.execute(
            pg_insert(_meta)
            .values(id=True, version=0, updated_at=_now())
            .on_conflict_do_nothing(index_elements=[_meta.c.id]),
        )

    async def get_version(self) -> int:
        await self._ensure_meta()
        result = await self.db.execute(select(_meta.c.version))
        return result.scalar_one()

    async def load(self, user_id: str) -> dict[str, Any]:
        version = await self.get_version()

        layer_rows = (
            (
                await self.db.execute(
                    select(_layers).order_by(_layers.c.display_order),
                )
            )
            .mappings()
            .all()
        )
        feature_rows = (
            (
                await self.db.execute(
                    select(_features).order_by(_features.c.created_at),
                )
            )
            .mappings()
            .all()
        )
        membership_rows = (
            (
                await self.db.execute(
                    select(
                        _memberships,
                        _visibility.c.visible,
                        _features.c.in_effect.label("feature_in_effect"),
                    )
                    .select_from(
                        _memberships.join(
                            _features,
                            _features.c.id == _memberships.c.feature_id,
                        ).outerjoin(
                            _visibility,
                            (_visibility.c.membership_id == _memberships.c.id)
                            & (_visibility.c.user_id == user_id),
                        ),
                    )
                    .order_by(
                        _memberships.c.layer_id,
                        _memberships.c.display_order,
                    ),
                )
            )
            .mappings()
            .all()
        )

        return {
            "version": version,
            "layers": [
                {
                    "id": str(row["id"]),
                    "name": row["name"],
                    "parent_id": (
                        str(row["parent_id"]) if row["parent_id"] else None
                    ),
                    "order": row["display_order"],
                    "default_style": row["default_style"] or {},
                }
                for row in layer_rows
            ],
            "features": [
                {
                    "id": str(row["id"]),
                    "type": row["feature_type"],
                    "name": row["name"],
                    "geometry": row["geometry"],
                    "in_effect": row["in_effect"],
                    "buffer_enabled": row["buffer_enabled"],
                    "buffer_distance_m": row["buffer_distance_m"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
                for row in feature_rows
            ],
            "memberships": [
                {
                    "id": str(row["id"]),
                    "feature_id": str(row["feature_id"]),
                    "layer_id": str(row["layer_id"]),
                    "order": row["display_order"],
                    "style_override": row["style_override"] or {},
                    "visible": (
                        row["feature_in_effect"]
                        if row["visible"] is None
                        else row["visible"]
                    ),
                }
                for row in membership_rows
            ],
        }

    async def replace(
        self,
        user_id: str,
        base_version: int,
        layers: list[dict[str, Any]],
        features: list[dict[str, Any]],
        memberships: list[dict[str, Any]],
    ) -> Optional[int]:
        await self._ensure_meta()

        bumped = (
            await self.db.execute(
                update(_meta)
                .where(_meta.c.version == base_version)
                .values(
                    version=_meta.c.version + 1,
                    updated_at=_now(),
                    updated_by=user_id,
                )
                .returning(_meta.c.version),
            )
        ).first()

        if bumped is None:
            await self.db.rollback()
            return None

        layer_ids = [layer["id"] for layer in layers]
        feature_ids = [feature["id"] for feature in features]
        membership_ids = [m["id"] for m in memberships]

        await self.db.execute(
            update(_layers)
            .where(_layers.c.id.in_(layer_ids))
            .values(parent_id=None),
        )

        await self.db.execute(
            delete(_memberships).where(
                _memberships.c.id.notin_(
                    membership_ids,
                ),
            ),
        )
        await self.db.execute(
            delete(_layers).where(_layers.c.id.notin_(layer_ids)),
        )
        await self.db.execute(
            delete(_features).where(_features.c.id.notin_(feature_ids)),
        )

        await self._upsert_layers(layers)
        await self._upsert_features(features)
        await self._upsert_memberships(memberships)
        await self._write_visibility(
            user_id,
            [
                {"membership_id": m["id"], "visible": m["visible"]}
                for m in memberships
            ],
        )

        await self.db.commit()
        return bumped[0]

    async def _upsert_layers(self, layers: list[dict[str, Any]]) -> None:
        if not layers:
            return

        stmt = pg_insert(_layers)
        await self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=[_layers.c.id],
                set_={
                    "name": stmt.excluded.name,
                    "parent_id": stmt.excluded.parent_id,
                    "display_order": stmt.excluded.display_order,
                    "default_style": stmt.excluded.default_style,
                },
            ),
            [
                {
                    "id": layer["id"],
                    "name": layer["name"],
                    "parent_id": None,
                    "display_order": layer["order"],
                    "default_style": layer["default_style"],
                }
                for layer in layers
            ],
        )

        parented = [
            {"b_id": layer["id"], "b_parent": layer["parent_id"]}
            for layer in layers
            if layer["parent_id"] is not None
        ]
        if parented:
            await self.db.execute(
                update(_layers)
                .where(_layers.c.id == bindparam("b_id"))
                .values(parent_id=bindparam("b_parent")),
                parented,
            )

    async def _upsert_features(self, features: list[dict[str, Any]]) -> None:
        if not features:
            return

        stmt = pg_insert(_features)
        await self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=[_features.c.id],
                set_={
                    "feature_type": stmt.excluded.feature_type,
                    "name": stmt.excluded.name,
                    "geometry": stmt.excluded.geometry,
                    "in_effect": stmt.excluded.in_effect,
                    "buffer_enabled": stmt.excluded.buffer_enabled,
                    "buffer_distance_m": stmt.excluded.buffer_distance_m,
                    "updated_at": stmt.excluded.updated_at,
                },
            ),
            [
                {
                    "id": feature["id"],
                    "feature_type": feature["type"],
                    "name": feature["name"],
                    "geometry": feature["geometry"],
                    "in_effect": feature["in_effect"],
                    "buffer_enabled": feature["buffer_enabled"],
                    "buffer_distance_m": feature["buffer_distance_m"],
                    "created_at": feature["created_at"],
                    "updated_at": feature["updated_at"],
                }
                for feature in features
            ],
        )

    async def _upsert_memberships(
        self,
        memberships: list[dict[str, Any]],
    ) -> None:
        if not memberships:
            return

        stmt = pg_insert(_memberships)
        await self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=[_memberships.c.id],
                set_={
                    "feature_id": stmt.excluded.feature_id,
                    "layer_id": stmt.excluded.layer_id,
                    "display_order": stmt.excluded.display_order,
                    "style_override": stmt.excluded.style_override,
                },
            ),
            [
                {
                    "id": m["id"],
                    "feature_id": m["feature_id"],
                    "layer_id": m["layer_id"],
                    "display_order": m["order"],
                    "style_override": m["style_override"],
                }
                for m in memberships
            ],
        )

    async def _write_visibility(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> None:
        if not entries:
            return

        stmt = pg_insert(_visibility)
        await self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=[
                    _visibility.c.membership_id,
                    _visibility.c.user_id,
                ],
                set_={"visible": stmt.excluded.visible},
            ),
            [
                {
                    "membership_id": entry["membership_id"],
                    "user_id": user_id,
                    "visible": entry["visible"],
                }
                for entry in entries
            ],
        )

    async def existing_membership_ids(self, ids: list[str]) -> set[str]:
        if not ids:
            return set()
        rows = await self.db.execute(
            select(_memberships.c.id).where(_memberships.c.id.in_(ids)),
        )
        return {str(row[0]) for row in rows}

    async def set_visibility(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> None:
        await self._write_visibility(user_id, entries)
        await self.db.commit()
