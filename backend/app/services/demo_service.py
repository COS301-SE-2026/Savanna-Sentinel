from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.repositories.risk_repository import GRID_FILE_PATH

if TYPE_CHECKING:
    from app.repositories.demo_repository import DemoRepository
    from app.services.media_service import MediaService
    from app.services.terrain_service import TerrainService

logger = logging.getLogger(__name__)

# The only account allowed to run demo actions, and the one a reset keeps.
DEMO_ADMIN_USERNAME = "admin1"


class DemoService:
    def __init__(
        self,
        repository: DemoRepository,
        media_service: MediaService,
        terrain: TerrainService | None = None,
    ) -> None:
        self.repository = repository
        self.media_service = media_service
        self.terrain = terrain

    async def reset(self) -> None:
        await self.repository.reset_database(DEMO_ADMIN_USERNAME)
        GRID_FILE_PATH.unlink(missing_ok=True)
        # The database is already reset, so a storage outage must not report
        # the whole reset as failed; leftover objects are harmless.
        try:
            self.media_service.empty_bucket()
        except Exception:
            logger.exception("Could not empty the media bucket after reset")

    async def insert_klaserie_workspace(self, user_id: str) -> None:
        snapshot = await self.repository.replace_workspace_with_klaserie(
            user_id,
        )
        if self.terrain is not None:
            try:
                await self.terrain.on_workspace_saved(snapshot)
            except Exception:
                logger.exception("Could not update terrain after the insert")
