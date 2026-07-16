from __future__ import annotations

import json
from typing import TYPE_CHECKING, Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import FieldReport

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class ReportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_list(
        self,
        owner_id: Optional[str],
        report_type: Optional[str] = None,
        severity: Optional[str] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        sync_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        if sync_status in ("offline", "pending"):
            return [], 0

        conditions = ["fr.deleted_at IS NULL"]
        params: dict = {}

        if owner_id is not None:
            conditions.append("fr.submitted_by::text = :owner_id")
            params["owner_id"] = owner_id

        if report_type:
            conditions.append("fr.report_type::text = :report_type")
            params["report_type"] = report_type

        if severity:
            conditions.append("i.severity::text = :severity")
            params["severity"] = severity

        if from_dt:
            conditions.append("fr.occurred_at >= :from_dt")
            params["from_dt"] = from_dt

        if to_dt:
            conditions.append("fr.occurred_at <= :to_dt")
            params["to_dt"] = to_dt

        where = " AND ".join(conditions)

        count_sql = text(f"""
            SELECT COUNT(DISTINCT fr.id)
            FROM field_reports fr
            LEFT JOIN incidents i ON i.field_report_id = fr.id
            LEFT JOIN sightings s ON s.field_report_id = fr.id
            WHERE {where}
        """)

        data_sql = text(f"""
            SELECT
                fr.id::text AS report_id,
                fr.report_type::text AS report_type,
                ST_Y(fr.location::geometry) AS lat,
                ST_X(fr.location::geometry) AS lon,
                fr.occurred_at,
                fr.description,
                i.incident_type,
                i.severity::text AS severity,
                s.species,
                s.count,
                fr.route_id::text AS route_id,
                'synced' AS sync_status,
                fr.submitted_by::text AS submitted_by,
                fr.created_at,
                fr.updated_at,
                fr.deleted_at,
                (
                    SELECT COALESCE(array_agg(p.image_url), ARRAY[]::text[])
                    FROM photos p
                    WHERE p.geospatial_event_id = i.id
                       OR p.geospatial_event_id = s.id
                ) AS images
            FROM field_reports fr
            LEFT JOIN incidents i ON i.field_report_id = fr.id
            LEFT JOIN sightings s ON s.field_report_id = fr.id
            WHERE {where}
            ORDER BY fr.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        data_params = {
            **params,
            "limit": page_size,
            "offset": (page - 1) * page_size,
        }

        total = (await self.db.execute(count_sql, params)).scalar() or 0
        rows = (await self.db.execute(data_sql, data_params)).mappings().all()

        results = []
        for row in rows:
            d = dict(row)
            d["location"] = {"lat": d.pop("lat"), "lon": d.pop("lon")}
            d["images"] = list(d.get("images") or [])
            results.append(d)

        return results, total

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
