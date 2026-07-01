from __future__ import annotations

import json
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import FieldReport


class ReportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, report_id: str) -> Optional[dict]:
        stmt = select(
            FieldReport.id,
            FieldReport.submitted_by,
            FieldReport.route_id,
            FieldReport.report_type,
            FieldReport.description,
            func.ST_AsGeoJSON(FieldReport.location).label("location"),
            FieldReport.occurred_at,
            FieldReport.created_at,
            FieldReport.updated_at,
        ).where(
            FieldReport.id == report_id,
            FieldReport.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).mappings().one_or_none()
        if row is None:
            return None
        data = dict(row)
        raw_loc = data.get("location")
        data["location"] = json.loads(raw_loc) if raw_loc else None
        data["images"] = []
        return data
