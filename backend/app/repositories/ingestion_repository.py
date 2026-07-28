from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

from sqlalchemy import insert

from app.models.file_ingestion_staging import FileIngestionStaging

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class IngestionRepository:
    def __init__(self, db: AsyncSession):
        if db is None:
            raise ValueError(
                "IngestionRepository needs an async database session",
            )
        self.db = db

    async def upload_file(
        self,
        records: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not records:
            return {"status": "success", "inserted_count": 0}
        stmt = insert(FileIngestionStaging).values(records)

        await self.db.execute(stmt)
        await self.db.commit()

        return {
            "status": "success",
            "inserted_count": len(records),
        }
