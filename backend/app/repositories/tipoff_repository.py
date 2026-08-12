from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import text

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession

class TipoffRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: str,
        report_type: str,
        location_wkt: str,
        occurred_at: datetime,
        description: str,
        incident_type: Optional[str] = None,
        severity: Optional[str] = None,
        species: Optional[str] = None,
        count: Optional[int] = None,
        images: Optional[list] = None,
    ) -> dict:
        tip_row = (
            await self.db.execute(
                text("""
                INSERT INTO tipoffs
                    (submitted_by, report_type, description, location,
                     occurred_at)
                VALUES
                    (:uid, CAST(:rtype AS report_type), :desc,
                     ST_GeogFromText(:wkt), :occurred_at)
                RETURNING id, created_at
            """),
                {
                    "uid": user_id,
                    "rtype": report_type,
                    "desc": description,
                    "wkt": location_wkt,
                    "occurred_at": occurred_at,
                },
            )
        ).fetchone()

        tipoff_id = str(tip_row[0])
        created_at = tip_row[1]

        ev_row = (
            await self.db.execute(
                text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES
                    (CAST(:etype AS event_type), ST_GeogFromText(:wkt),
                      :occurred_at)
                RETURNING id
            """),
                {
                    "etype": report_type,
                    "wkt": location_wkt,
                    "occurred_at": occurred_at,
                },
            )
        ).fetchone()
        event_id = str(ev_row[0])

        if report_type == "incident":
            await self.db.execute(
                text("""
                    INSERT INTO incidents
                        (id, tipoff_id, incident_type, severity)
                    VALUES
                        (:id, :tip_id, :itype, CAST(:sev AS severity_level))
                """),
                {
                    "id": event_id,
                    "tip_id": tipoff_id,
                    "itype": incident_type,
                    "sev": severity,
                },
            )
        else:
            await self.db.execute(
                text("""
                    INSERT INTO sightings
                        (id, tipoff_id, species, count)
                    VALUES
                        (:id, :tip_id, :species, :cnt)
                """),
                {
                    "id": event_id,
                    "tip_id": tipoff_id,
                    "species": species,
                    "cnt": count,
                },
            )

        for url in images or []:
            await self.db.execute(
                text("""
                    INSERT INTO photos (geospatial_event_id, image_url)
                    VALUES (:eid, :url)
                """),
                {"eid": event_id, "url": url},
            )

        await self.db.commit()

        return {
            "tipoff_id": tipoff_id,
            "report_type": report_type,
            "status": "submitted",
            "submitted_by": user_id,
            "created_at": created_at,
        }

    async def get_list(
        self,
        owner_id: Optional[str],
        report_type: Optional[str] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        conditions = ["t.deleted_at IS NULL"]
        params: dict = {}

        if owner_id is not None:
            conditions.append("t.submitted_by::text = :owner_id")
            params["owner_id"] = owner_id

        if report_type is not None:
            conditions.append("t.report_type::text = :report_type")
            params["report_type"] = report_type

        if from_dt:
            conditions.append("t.occurred_at >= :from_dt")
            params["from_dt"] = from_dt

        if to_dt:
            conditions.append("t.occurred_at <= :to_dt")
            params["to_dt"] = to_dt

        where = " AND ".join(conditions)

        count_sql = text(f"""
            SELECT COUNT(DISTINCT t.id)
            FROM tipoffs t
            LEFT JOIN incidents i ON i.tipoff_id = t.id
            LEFT JOIN sightings s ON s.tipoff_id = t.id
            WHERE {where}
        """)

        data_sql = text(f"""
            SELECT
                t.id::text AS tipoff_id,
                t.report_type::text AS report_type,
                ST_Y(t.location::geometry) AS lat,
                ST_X(t.location::geometry) AS lon,
                t.occurred_at,
                t.description,
                i.incident_type,
                i.severity::text AS severity,
                s.species,
                s.count,
                'synced' AS sync_status,
                t.submitted_by::text AS submitted_by,
                u.username AS submitted_by_username,
                t.created_at,
                (
                    SELECT COALESCE(array_agg(p.image_url), ARRAY[]::text[])
                    FROM photos p
                    WHERE p.geospatial_event_id = i.id
                       OR p.geospatial_event_id = s.id
                ) AS images
            FROM tipoffs t
            LEFT JOIN incidents i ON i.tipoff_id = t.id
            LEFT JOIN sightings s ON s.tipoff_id = t.id
            LEFT JOIN users u ON u.id = t.submitted_by
            WHERE {where}
            ORDER BY t.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        total = (await self.db.execute(count_sql, params)).scalar() or 0
        rows = (
            await self.db.execute(
                data_sql,
                {
                    **params,
                    "limit": page_size,
                    "offset": (page - 1) * page_size,
                },
            )
        ).mappings().all()

        results = []
        for row in rows:
            d = dict(row)
            d["location"] = {"lat": d.pop("lat"), "lon": d.pop("lon")}
            d["images"] = list(d.get("images") or [])
            results.append(d)

        return results, total
