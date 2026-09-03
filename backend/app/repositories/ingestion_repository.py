from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List

from fastapi import HTTPException, status

from app.repositories.report_repository import ReportRepository
from app.repositories.tipoff_repository import TipoffRepository
from app.repositories.user_repository import UserRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

_ROLE_TARGET = {
    "ranger": "field_report",
    "community_liaison": "tipoff",
}


class IngestionRepository:
    def __init__(self, db: AsyncSession):
        if db is None:
            raise ValueError(
                "IngestionRepository needs an async database session",
            )
        self.db = db
        self.users = UserRepository(db)
        self.reports = ReportRepository(db)
        self.tipoffs = TipoffRepository(db)

    async def upload_file(
        self,
        records: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not records:
            return {"status": "success", "inserted_count": 0}

        for index, record in enumerate(records):
            await self._insert_record(record, index)

        return {
            "status": "success",
            "inserted_count": len(records),
        }

    async def _insert_record(self, record: Dict[str, Any], index: int) -> None:
        username = record["submitted_by"]
        user = await self.users.get_by_username(username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "message": f"Row {index + 1}: no user found with "
                    f"username '{username}'",
                },
            )

        target = _ROLE_TARGET.get(user.role)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "message": f"Row {index + 1}: user '{username}' has "
                    f"role '{user.role}', which cannot submit reports "
                    "(must be ranger or community_liaison)",
                },
            )

        location_wkt = f"POINT({record['lon']} {record['lat']})"
        kwargs = {
            "user_id": str(user.id),
            "report_type": record["report_type"],
            "location_wkt": location_wkt,
            "occurred_at": record["occurred_at"],
            "description": record["description"],
            "incident_type": record.get("incident_type"),
            "severity": record.get("severity"),
            "species": record.get("species"),
            "count": record.get("count"),
        }

        if target == "field_report":
            await self.reports.create(**kwargs)
        else:
            await self.tipoffs.create(**kwargs)
