from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Integer,
    MetaData,
    Table,
    Text,
    cast,
    func,
    insert,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.models.report import GeographyPoint
from app.models.tipoff import TipOff

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


_metadata = MetaData()
_event_type = Enum(
    "incident",
    "sighting",
    "patrol_track",
    name="event_type",
    create_type=False,
)
_severity_level = Enum(
    "low",
    "medium",
    "high",
    name="severity_level",
    create_type=False,
)
_geospatial_events = Table(
    "geospatial_events",
    _metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("event_type", _event_type, nullable=False),
    Column("location", GeographyPoint(), nullable=False),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
)
_incidents = Table(
    "incidents",
    _metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("tipoff_id", UUID(as_uuid=False), nullable=True),
    Column("incident_type", Text, nullable=False),
    Column("severity", _severity_level),
)
_sightings = Table(
    "sightings",
    _metadata,
    Column("id", UUID(as_uuid=False), primary_key=True),
    Column("tipoff_id", UUID(as_uuid=False), nullable=True),
    Column("species", Text, nullable=False),
    Column("count", Integer),
)
_photos = Table(
    "photos",
    _metadata,
    Column("geospatial_event_id", UUID(as_uuid=False), nullable=False),
    Column("image_url", Text, nullable=False),
)


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
                insert(TipOff)
                .values(
                    submitted_by=user_id,
                    report_type=cast(
                        report_type,
                        TipOff.__table__.c.report_type.type,
                    ),
                    description=description,
                    location=func.ST_GeogFromText(location_wkt),
                    occurred_at=occurred_at,
                )
                .returning(TipOff.id, TipOff.created_at),
            )
        ).one()

        tipoff_id = str(tip_row[0])
        created_at = tip_row[1]

        ev_row = (
            await self.db.execute(
                insert(_geospatial_events)
                .values(
                    event_type=cast(report_type, _event_type),
                    location=func.ST_GeogFromText(location_wkt),
                    occurred_at=occurred_at,
                )
                .returning(_geospatial_events.c.id),
            )
        ).one()
        event_id = str(ev_row[0])

        if report_type == "incident":
            await self.db.execute(
                insert(_incidents).values(
                    id=event_id,
                    tipoff_id=tipoff_id,
                    incident_type=incident_type,
                    severity=cast(severity, _severity_level),
                ),
            )
        else:
            await self.db.execute(
                insert(_sightings).values(
                    id=event_id,
                    tipoff_id=tipoff_id,
                    species=species,
                    count=count,
                ),
            )

        for url in images or []:
            await self.db.execute(
                insert(_photos).values(
                    geospatial_event_id=event_id,
                    image_url=url,
                ),
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
        search: Optional[str] = None,
        report_types: Optional[list[str]] = None,
        severities: Optional[list[str]] = None,
        species: Optional[list[str]] = None,
        users: Optional[list[str]] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        conditions = ["t.deleted_at IS NULL"]
        params: dict = {}

        if search and search.strip():
            conditions.append(
                "(t.description ILIKE :search OR s.species ILIKE :search)",
            )
            params["search"] = f"%{search.strip()}%"

        if owner_id is not None:
            conditions.append("t.submitted_by::text = :owner_id")
            params["owner_id"] = owner_id

        if report_types:
            conditions.append("t.report_type::text = ANY(:report_types)")
            params["report_types"] = report_types

        if severities:
            conditions.append("i.severity::text = ANY(:severities)")
            params["severities"] = severities

        if species:
            conditions.append("s.species = ANY(:species)")
            params["species"] = species

        if users:
            conditions.append("u.username = ANY(:users)")
            params["users"] = users

        if from_dt:
            conditions.append("t.occurred_at >= :from_dt")
            params["from_dt"] = from_dt

        if to_dt:
            conditions.append("t.occurred_at <= :to_dt")
            params["to_dt"] = to_dt

        where = " AND ".join(conditions)

        count_sql = text(
            f"""
            SELECT COUNT(DISTINCT t.id)
            FROM tipoffs t
            LEFT JOIN incidents i ON i.tipoff_id = t.id
            LEFT JOIN sightings s ON s.tipoff_id = t.id
            LEFT JOIN users u ON u.id = t.submitted_by
            WHERE {where}
        """,  # nosec B608
        )

        data_sql = text(
            f"""
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
        """,  # nosec B608
        )

        total = (await self.db.execute(count_sql, params)).scalar() or 0
        rows = (
            (
                await self.db.execute(
                    data_sql,
                    {
                        **params,
                        "limit": page_size,
                        "offset": (page - 1) * page_size,
                    },
                )
            )
            .mappings()
            .all()
        )

        results = []
        for row in rows:
            d = dict(row)
            d["location"] = {"lat": d.pop("lat"), "lon": d.pop("lon")}
            d["images"] = list(d.get("images") or [])
            results.append(d)

        return results, total

    async def get_species(self) -> list[str]:
        sql = text("""
            SELECT DISTINCT s.species
            FROM sightings s
            JOIN tipoffs t ON t.id = s.tipoff_id
            WHERE t.deleted_at IS NULL
            AND s.species IS NOT NULL AND TRIM(s.species) != ''
            ORDER BY s.species ASC
        """)

        result = await self.db.execute(sql)
        return list(result.scalars().all())

    async def get_usernames(self) -> list[str]:
        sql = text("""
            SELECT DISTINCT u.username
            FROM tipoffs t
            JOIN users u ON u.id = t.submitted_by
            WHERE t.deleted_at IS NULL
            AND u.username IS NOT NULL
            AND TRIM(u.username) != ''
            ORDER BY u.username ASC
        """)

        result = await self.db.execute(sql)
        return list(result.scalars().all())
