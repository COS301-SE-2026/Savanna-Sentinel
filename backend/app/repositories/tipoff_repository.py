from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import insert, text

from app.models.tipoff import TipOff

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
        stmt = (
            insert(TipOff)
            .values(
                submitted_by=user_id,
                report_type=report_type,
                description=description,
                location=text("ST_GeogFromText(:wkt)"),
                occurred_at=occurred_at,
            )
            .returning(TipOff.id, TipOff.created_at)
        )
        tip_row = (await self.db.execute(
            stmt,
            {"wkt": location_wkt})).fetchone()

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
