from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import Text, all_, bindparam, delete, func, select, update
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.terrain import TerrainCellEffect, TerrainEffectsMeta
from app.workers.terrain.hashing import EMPTY_HASH

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

_effects = TerrainCellEffect.__table__
_meta = TerrainEffectsMeta.__table__


class TerrainRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _ensure_meta(self) -> None:
        await self.db.execute(
            pg_insert(_meta)
            .values(
                id=True,
                requested_hash=EMPTY_HASH,
                computed_hash=EMPTY_HASH,
            )
            .on_conflict_do_nothing(index_elements=[_meta.c.id]),
        )

    async def set_requested_hash(self, new_hash: str) -> bool:
        await self._ensure_meta()
        result = await self.db.execute(
            update(_meta)
            .values(requested_hash=new_hash)
            .returning(_meta.c.computed_hash),
        )
        computed_hash = result.scalar_one()
        await self.db.commit()
        return computed_hash != new_hash

    async def replace_effects(
        self,
        effects: dict[str, dict[str, float]],
        computed_hash: str,
        computed_version: int,
    ) -> bool:
        await self._ensure_meta()
        requested = (
            await self.db.execute(
                select(_meta.c.requested_hash).with_for_update(),
            )
        ).scalar_one()
        if requested != computed_hash:
            await self.db.rollback()
            return False

        refs = list(effects)
        if refs:
            await self.db.execute(
                delete(_effects).where(
                    _effects.c.cell_ref
                    != all_(bindparam("refs", refs, type_=ARRAY(Text))),
                ),
            )
            stmt = pg_insert(_effects)
            await self.db.execute(
                stmt.on_conflict_do_update(
                    index_elements=[_effects.c.cell_ref],
                    set_={
                        "risk_delta": stmt.excluded.risk_delta,
                        "route_multiplier": stmt.excluded.route_multiplier,
                    },
                ),
                [
                    {
                        "cell_ref": ref,
                        "risk_delta": values["risk_delta"],
                        "route_multiplier": values["route_multiplier"],
                    }
                    for ref, values in effects.items()
                ],
            )
        else:
            await self.db.execute(delete(_effects))

        await self.db.execute(
            update(_meta).values(
                computed_hash=computed_hash,
                computed_version=computed_version,
                computed_at=func.now(),
            ),
        )
        await self.db.commit()
        return True

    async def get_effects(self) -> list[tuple[str, float, float]]:
        rows = await self.db.execute(
            select(
                _effects.c.cell_ref,
                _effects.c.risk_delta,
                _effects.c.route_multiplier,
            ),
        )
        return [
            (row.cell_ref, row.risk_delta, row.route_multiplier) for row in rows
        ]

    async def get_meta(self) -> dict[str, Any]:
        row = (await self.db.execute(select(_meta))).mappings().first()
        if row is None:
            return {
                "requested_hash": EMPTY_HASH,
                "computed_hash": EMPTY_HASH,
                "computed_version": None,
                "computed_at": None,
            }
        return {
            "requested_hash": row["requested_hash"],
            "computed_hash": row["computed_hash"],
            "computed_version": row["computed_version"],
            "computed_at": row["computed_at"],
        }
