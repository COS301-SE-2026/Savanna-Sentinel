from typing import Optional

from pydantic import BaseModel


class TerrainEffectsResponse(BaseModel):
    computed_version: Optional[int] = None
    computed_at: Optional[str] = None
    stale: bool
    cells: dict[str, float] = {}
