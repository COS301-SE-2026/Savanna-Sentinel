from __future__ import annotations

import json
from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException, status
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
        search: Optional[str] = None,
        report_types: Optional[list[str]] = None,
        severities: Optional[list[str]] = None,
        species: Optional[list[str]] = None,
        users: Optional[list[str]] = None,
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

        if search and search.strip():
            conditions.append(
                "(fr.description ILIKE :search OR s.species ILIKE :search)",
            )
            params["search"] = f"%{search.strip()}%"

        if owner_id is not None:
            conditions.append("fr.submitted_by::text = :owner_id")
            params["owner_id"] = owner_id

        if report_types:
            conditions.append("fr.report_type::text = ANY(:report_type)")
            params["report_type"] = report_types

        if severities:
            conditions.append("i.severity::text = ANY(:severities)")
            params["severity"] = severities

        if species:
            conditions.append("s.species = ANY(:species)")
            params["species"] = species

        if users:
            conditions.append("u.username = ANY(:users)")
            params["users"] = users

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
            LEFT JOIN users u ON u.id = fr.submitted_by
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
                u.username AS submitted_by_username,
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
            LEFT JOIN users u ON u.id = fr.submitted_by
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

    async def create(
        self,
        user_id: str,
        report_type: str,
        location_wkt: str,
        occurred_at: "datetime",
        description: str,
        route_id: Optional[str] = None,
        incident_type: Optional[str] = None,
        severity: Optional[str] = None,
        species: Optional[str] = None,
        count: Optional[int] = None,
        images: Optional[list] = None,
    ) -> dict:
        if route_id is not None:
            exists = (
                await self.db.execute(
                    text("SELECT 1 FROM patrol_routes WHERE id::text = :rid"),
                    {"rid": route_id},
                )
            ).fetchone()
            if exists is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="route_id does not refer to an existing patrol "
                    "route",
                )

        fr_row = (
            await self.db.execute(
                text("""
                INSERT INTO field_reports
                    (submitted_by, report_type, description, location,
                     occurred_at, route_id)
                VALUES
                    (:uid, CAST(:rtype AS report_type), :desc,
                     ST_GeogFromText(:wkt), :occurred_at, :route_id)
                RETURNING id, created_at
            """),
                {
                    "uid": user_id,
                    "rtype": report_type,
                    "desc": description,
                    "wkt": location_wkt,
                    "occurred_at": occurred_at,
                    "route_id": route_id,
                },
            )
        ).fetchone()

        field_report_id = str(fr_row[0])
        created_at = fr_row[1]

        ev_row = (
            await self.db.execute(
                text("""
                INSERT INTO geospatial_events
                    (event_type, location, occurred_at)
                VALUES
                    (CAST(:etype AS event_type), ST_GeogFromText(:wkt)
                     , :occurred_at)
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
                        (id, field_report_id, incident_type, severity)
                    VALUES
                        (:id, :fr_id, :itype, CAST(:sev AS severity_level))
                """),
                {
                    "id": event_id,
                    "fr_id": field_report_id,
                    "itype": incident_type,
                    "sev": severity,
                },
            )
        else:
            await self.db.execute(
                text("""
                    INSERT INTO sightings
                        (id, field_report_id, species, count)
                    VALUES
                        (:id, :fr_id, :species, :cnt)
                """),
                {
                    "id": event_id,
                    "fr_id": field_report_id,
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
            "report_id": field_report_id,
            "report_type": report_type,
            "status": "submitted",
            "submitted_by": user_id,
            "created_at": created_at,
        }

    async def update(
        self,
        report_id: str,
        report_type: str,
        fields: dict,
    ) -> dict:
        row = await self._update_field_report_row(report_id, fields)
        event_id = await self._get_event_id(report_id)

        if event_id:
            await self._update_geospatial_event(event_id, fields)
            await self._update_type_specific_fields(
                report_type,
                event_id,
                fields,
            )
            await self._replace_images(event_id, fields)

        await self.db.commit()

        return {
            "report_id": str(row[0]),
            "report_type": row[1],
            "status": "updated",
            "submitted_by": str(row[2]),
            "created_at": row[3],
        }

    async def _update_field_report_row(self, report_id: str, fields: dict):
        fr_sets = []
        fr_params: dict = {"rid": report_id}

        if "description" in fields:
            fr_sets.append("description = :description")
            fr_params["description"] = fields["description"]
        if "location_wkt" in fields:
            fr_sets.append("location = ST_GeogFromText(:wkt)")
            fr_params["wkt"] = fields["location_wkt"]
        if "occurred_at" in fields:
            fr_sets.append("occurred_at = :occurred_at")
            fr_params["occurred_at"] = fields["occurred_at"]
        fr_sets.append("updated_at = NOW()")

        return (
            await self.db.execute(
                text(f"""
                    UPDATE field_reports
                    SET {", ".join(fr_sets)}
                    WHERE id = :rid
                    RETURNING id, report_type, submitted_by, created_at
                """),
                fr_params,
            )
        ).fetchone()

    async def _get_event_id(self, report_id: str) -> Optional[str]:
        event_row = (
            await self.db.execute(
                text("""
                    SELECT id FROM incidents WHERE field_report_id = :rid
                    UNION
                    SELECT id FROM sightings WHERE field_report_id = :rid
                """),
                {"rid": report_id},
            )
        ).fetchone()
        return str(event_row[0]) if event_row else None

    async def _update_geospatial_event(
        self,
        event_id: str,
        fields: dict,
    ) -> None:
        ev_sets = []
        ev_params: dict = {"eid": event_id}
        if "location_wkt" in fields:
            ev_sets.append("location = ST_GeogFromText(:wkt)")
            ev_params["wkt"] = fields["location_wkt"]
        if "occurred_at" in fields:
            ev_sets.append("occurred_at = :occurred_at")
            ev_params["occurred_at"] = fields["occurred_at"]
        if not ev_sets:
            return

        await self.db.execute(
            text(f"""
                UPDATE geospatial_events
                SET {", ".join(ev_sets)}
                WHERE id = :eid
            """),
            ev_params,
        )

    async def _update_type_specific_fields(
        self,
        report_type: str,
        event_id: str,
        fields: dict,
    ) -> None:
        if report_type == "incident":
            await self._update_incident(event_id, fields)
        elif report_type == "sighting":
            await self._update_sighting(event_id, fields)

    async def _update_incident(self, event_id: str, fields: dict) -> None:
        inc_sets = []
        inc_params: dict = {"eid": event_id}
        if "incident_type" in fields:
            inc_sets.append("incident_type = :incident_type")
            inc_params["incident_type"] = fields["incident_type"]
        if "severity" in fields:
            inc_sets.append("severity = CAST(:severity AS severity_level)")
            inc_params["severity"] = fields["severity"]
        if not inc_sets:
            return

        await self.db.execute(
            text(f"""
                UPDATE incidents
                SET {", ".join(inc_sets)}
                WHERE id = :eid
            """),
            inc_params,
        )

    async def _update_sighting(self, event_id: str, fields: dict) -> None:
        sig_sets = []
        sig_params: dict = {"eid": event_id}
        if "species" in fields:
            sig_sets.append("species = :species")
            sig_params["species"] = fields["species"]
        if "count" in fields:
            sig_sets.append("count = :count")
            sig_params["count"] = fields["count"]
        if not sig_sets:
            return

        await self.db.execute(
            text(f"""
                UPDATE sightings
                SET {", ".join(sig_sets)}
                WHERE id = :eid
            """),
            sig_params,
        )

    async def _replace_images(self, event_id: str, fields: dict) -> None:
        if "images" not in fields:
            return

        await self.db.execute(
            text("DELETE FROM photos WHERE geospatial_event_id = :eid"),
            {"eid": event_id},
        )
        for url in fields["images"] or []:
            await self.db.execute(
                text("""
                    INSERT INTO photos (geospatial_event_id, image_url)
                    VALUES (:eid, :url)
                """),
                {"eid": event_id, "url": url},
            )

    async def soft_delete(self, report_id: str) -> bool:
        row = (
            await self.db.execute(
                text("""
                    UPDATE field_reports
                    SET deleted_at = NOW()
                    WHERE id = :rid AND deleted_at IS NULL
                    RETURNING id
                """),
                {"rid": report_id},
            )
        ).fetchone()
        await self.db.commit()
        return row is not None

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
        data["images"] = await self._get_images(report_id)
        return data

    async def _get_images(self, report_id: str) -> list:
        event_id = await self._get_event_id(report_id)
        if event_id is None:
            return []

        rows = (
            await self.db.execute(
                text("""
                    SELECT image_url FROM photos
                    WHERE geospatial_event_id = :eid
                """),
                {"eid": event_id},
            )
        ).fetchall()
        return [row[0] for row in rows]

    async def get_species(self) -> list[str]:
        sql = text("""
            SELECT DISTINCT species
            FROM sightings
            WHERE species IS NOT NULL AND TRIM(species) != ''
            ORDER BY species ASC
        """)

        result = await self.db.execute(sql)
        return list(result.scalars().all())

    async def get_usernames(self) -> list[str]:
        sql = text("""
            SELECT DISTINCT u.username
            FROM field_reports fr
            JOIN users u ON u.id = fr.submitted_by
            WHERE fr.deleted_at IS NULL
            AND u.username IS NOT NULL
            AND TRIM(u.username) != ''
            ORDER BY u.username ASC
        """)

        result = await self.db.execute(sql)
        return list(result.scalars().all())
