from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class PatrolRouteRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: str,
        request_id: str,
        start_point_wkt: str,
        max_time: float,
        max_fuel: float,
        path_wkt: str,
        estimated_time: float,
        estimated_fuel: float,
        risk_coverage: float,
    ) -> dict:
        row = (
            await self.db.execute(
                text("""
                    INSERT INTO patrol_routes
                        (request_id, requested_by, start_point, max_time,
                         max_fuel, suggested_path, estimated_time,
                         estimated_fuel, risk_coverage)
                    VALUES
                        (:request_id, :user_id, ST_GeogFromText(:start_wkt),
                         :max_time, :max_fuel, ST_GeogFromText(:path_wkt),
                         :estimated_time, :estimated_fuel, :risk_coverage)
                    RETURNING id, created_at
                """),
                {
                    "request_id": request_id,
                    "user_id": user_id,
                    "start_wkt": start_point_wkt,
                    "max_time": max_time,
                    "max_fuel": max_fuel,
                    "path_wkt": path_wkt,
                    "estimated_time": estimated_time,
                    "estimated_fuel": estimated_fuel,
                    "risk_coverage": risk_coverage,
                },
            )
        ).fetchone()
        await self.db.commit()
        return {"id": str(row[0]), "created_at": row[1]}

    async def list_by_user(
        self,
        user_id: str,
        page: int,
        page_size: int,
    ) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size
        rows = (
            await self.db.execute(
                text("""
                    SELECT id::text AS id, request_id::text AS request_id,
                        ST_AsGeoJSON(start_point::geometry)::json AS start_point,
                        max_time, max_fuel,
                        ST_AsGeoJSON(suggested_path::geometry)::json AS path_geometry,
                        estimated_time, estimated_fuel, risk_coverage, created_at
                    FROM patrol_routes
                    WHERE requested_by = :user_id
                    ORDER BY created_at DESC
                    LIMIT :limit OFFSET :offset
                """),
                {"user_id": user_id, "limit": page_size, "offset": offset},
            )
        ).mappings().all()

        total = (
            await self.db.execute(
                text("SELECT COUNT(*) FROM patrol_routes WHERE requested_by = :user_id"),
                {"user_id": user_id},
            )
        ).scalar_one()

        return [dict(r) for r in rows], total
