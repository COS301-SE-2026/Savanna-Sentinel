from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    Text,
    func,
    insert,
    select,
    text,
)

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

    async def get_list(
        self,
        owner_id: Optional[str],
        report_type: Optional[str] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        md = MetaData()
        t = Table(
            "tipoffs",
            md,
            Column("id", String),
            Column("report_type", String),
            Column("location", Text),
            Column("occurred_at", DateTime(timezone=True)),
            Column("description", Text),
            Column("submitted_by", String),
            Column("created_at", DateTime(timezone=True)),
            Column("deleted_at", DateTime(timezone=True)),
        )
        i = Table(
            "incidents",
            md,
            Column("id", String),
            Column("tipoff_id", String),
            Column("incident_type", Text),
            Column("severity", String),
        )
        s = Table(
            "sightings",
            md,
            Column("id", String),
            Column("tipoff_id", String),
            Column("species", Text),
            Column("count", String),
        )
        p = Table(
            "photos",
            md,
            Column("geospatial_event_id", String),
            Column("image_url", Text),
        )
        u = Table(
            "users",
            md,
            Column("id", String),
            Column("username", String),
        )

        conds = [t.c.deleted_at.is_(None)]
        if owner_id is not None:
            conds.append(t.c.submitted_by == owner_id)
        if report_type is not None:
            conds.append(t.c.report_type == report_type)
        if from_dt:
            conds.append(t.c.occurred_at >= from_dt)
        if to_dt:
            conds.append(t.c.occurred_at <= to_dt)

        count_stmt = (
            select(func.count(func.distinct(t.c.id)))
            .select_from(
                t.outerjoin(i, i.c.tipoff_id == t.c.id)
                .outerjoin(s, s.c.tipoff_id == t.c.id),
            )
            .where(*conds)
        )

        total = (await self.db.execute(count_stmt)).scalar or 0

        location_geom = t.c.location.cast("geometry")
        images_subq = (
            select(
                func.coalesce(
                    func.array_agg(p.c.image_url), text("ARRAY[]::text[]"),
                ),
            )
            .where(p.c.geospatial_event_id == func.coalesce(i.c.id, s.c.id))
            .scalar_subquery()
        )

        data_stmt = (
            select(
                t.c.id.label("tipoff_id"),
                t.c.report_type.label("report_type"),
                func.ST_Y(location_geom).label("lat"),
                func.ST_X(location_geom).label("lon"),
                t.c.occurred_at,
                t.c.description,
                i.c.incident_type.label("incident_type"),
                i.c.severity.label("severity"),
                s.c.species.label("species"),
                s.c.count.label("count"),
                text("'synced'").label("sync_status"),
                t.c.submitted_by.label("submitted_by"),
                u.c.username.label("submitted_by_username"),
                t.c.created_at,
                images_subq.label("images"),
            )
            .select_from(
                t.outerjoin(i, i.c.tipoff_id == t.c.id)
                .outerjoin(s, s.c.tipoff_id == t.c.id)
                .outerjoin(u, u.c.id == t.c.submitted_by),
            )
            .where(*conds)
            .order_by(t.c.created_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )

        rows = (await self.db.execute(data_stmt)).mappings().all()

        results = []
        for row in rows:
            d = dict(row)
            d["location"] = {"lat": d.pop("lat"), "lon": d.pop("lon")}
            d["images"] = list(d.get("images") or [])
            results.append(d)

        return results, total
