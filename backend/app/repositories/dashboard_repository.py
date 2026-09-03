from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import text

if TYPE_CHECKING:
    from datetime import datetime


async def get_operational_stats(session, park_id: str, since: datetime) -> dict:
    reports = (
        await session.execute(
            text("""
                SELECT COUNT(*) FROM field_reports
                WHERE deleted_at IS NULL AND created_at >= :since
            """),
            {"since": since},
        )
    ).scalar_one()

    tipoffs = (
        await session.execute(
            text("""
                SELECT COUNT(*) FROM tipoffs
                WHERE deleted_at IS NULL AND created_at >= :since
            """),
            {"since": since},
        )
    ).scalar_one()

    active_rangers = (
        await session.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE role = 'ranger' AND is_active = true",
            ),
        )
    ).scalar_one()

    patrols = (
        await session.execute(
            text("""
                SELECT COUNT(*)
                FROM patrol_tracks pt
                JOIN geospatial_events ge ON ge.id = pt.id
                WHERE ge.occurred_at >= :since
            """),
            {"since": since},
        )
    ).scalar_one()

    return {
        "reports_this_week": reports,
        "tipoffs_this_week": tipoffs,
        "active_rangers": active_rangers,
        "patrols_this_week": patrols,
    }


async def get_patrol_coverage(
    session,
    park_id: str,
    since: datetime,
) -> tuple[float, float]:
    row = (
        await session.execute(
            text("""
                SELECT
                    COALESCE(SUM(ST_Area(gc.polygon_bounds)) FILTER (
                        WHERE EXISTS (
                            SELECT 1 FROM patrol_tracks pt
                            JOIN geospatial_events ge ON ge.id = pt.id
                            WHERE ST_Intersects(
                                gc.polygon_bounds::geometry,
                                pt.route_line::geometry
                            )
                              AND ge.occurred_at >= :since
                        )
                    ), 0) AS covered_area_m2,
                    COALESCE(SUM(ST_Area(gc.polygon_bounds)), 0)
                        AS total_area_m2
                FROM grid_cells gc
                WHERE gc.park_id = :park_id
            """),
            {"park_id": park_id, "since": since},
        )
    ).one()

    return row.covered_area_m2 / 1_000_000, row.total_area_m2 / 1_000_000


async def get_report_trends(
    session,
    since: datetime,
) -> tuple[list[dict], list[dict]]:
    counts_by_type = (
        (
            await session.execute(
                text("""
                SELECT report_type::text AS report_type, COUNT(*) AS count
                FROM field_reports
                WHERE deleted_at IS NULL
                GROUP BY report_type
            """),
            )
        )
        .mappings()
        .all()
    )

    trend = (
        (
            await session.execute(
                text("""
                SELECT date_trunc('day', occurred_at)::date AS day,
                    COUNT(*) AS count
                FROM field_reports
                WHERE deleted_at IS NULL AND occurred_at >= :since
                GROUP BY day
                ORDER BY day
            """),
                {"since": since},
            )
        )
        .mappings()
        .all()
    )

    return [dict(r) for r in counts_by_type], [
        {"date": r["day"].isoformat(), "count": r["count"]} for r in trend
    ]


async def get_recent_field_reports(
    session,
    park_id: str,
    limit: int = 5,
) -> list[dict]:
    rows = (
        (
            await session.execute(
                text("""
                SELECT
                    fr.id::text AS report_id,
                    u.username AS ranger,
                    fr.report_type::text AS report_type,
                    i.severity::text AS severity,
                    gc.row_index AS row_index,
                    gc.col_index AS col_index,
                    fr.occurred_at
                FROM field_reports fr
                LEFT JOIN incidents i ON i.field_report_id = fr.id
                LEFT JOIN users u ON u.id = fr.submitted_by
                LEFT JOIN grid_cells gc
                    ON gc.park_id = :park_id
                    AND ST_Contains(
                        gc.polygon_bounds::geometry, fr.location::geometry
                    )
                WHERE fr.deleted_at IS NULL
                ORDER BY fr.occurred_at DESC
                LIMIT :limit
            """),
                {"park_id": park_id, "limit": limit},
            )
        )
        .mappings()
        .all()
    )

    return [
        {
            "report_id": r["report_id"],
            "ranger": r["ranger"],
            "report_type": r["report_type"],
            "severity": r["severity"],
            "zone": (
                f"Cell {r['row_index'] + 1}-{r['col_index'] + 1}"
                if r["row_index"] is not None
                else None
            ),
            "occurred_at": r["occurred_at"].isoformat(),
        }
        for r in rows
    ]
