from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.schemas.terrain import TerrainEffectsResponse
from app.workers.terrain.hashing import rules_projection_hash
from app.workers.terrain.rules import resolve_feature_rules

if TYPE_CHECKING:
    from collections.abc import Callable

    from app.repositories.terrain_repository import TerrainRepository

logger = logging.getLogger(__name__)


def enqueue_recompute() -> None:
    from app.workers.tasks.terrain_tasks import compute_terrain_effects

    compute_terrain_effects.apply_async()


def enqueue_recompute_quietly() -> None:
    try:
        enqueue_recompute()
    except Exception:
        logger.exception("Could not queue the terrain recompute")


class TerrainService:
    def __init__(
        self,
        repo: TerrainRepository,
        enqueue: Callable[[], None] | None = None,
    ):
        self.repo = repo
        self._enqueue = enqueue or enqueue_recompute

    async def on_workspace_saved(self, snapshot: dict[str, Any]) -> bool:
        resolved = resolve_feature_rules(snapshot)
        digest = rules_projection_hash(snapshot["features"], resolved)
        if not await self.repo.set_requested_hash(digest):
            return False

        try:
            self._enqueue()
        except Exception:
            logger.exception("Could not queue the terrain recompute")
        return True

    async def risk_adjustments(self) -> TerrainEffectsResponse:
        return await self._respond(await self.repo.get_risk_deltas())

    async def route_costs(self) -> TerrainEffectsResponse:
        rows = await self.repo.get_effects()
        return await self._respond(
            {ref: route for ref, _, route in rows if route != 1.0},
        )

    async def _respond(self, cells: dict[str, float]) -> TerrainEffectsResponse:
        meta = await self.repo.get_meta()
        computed_at = meta["computed_at"]
        return TerrainEffectsResponse(
            computed_version=meta["computed_version"],
            computed_at=computed_at.isoformat() if computed_at else None,
            stale=meta["requested_hash"] != meta["computed_hash"],
            cells=cells,
        )
