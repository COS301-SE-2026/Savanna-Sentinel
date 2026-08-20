from __future__ import annotations

from datetime import datetime

from sqlalchemy import text


async def get_operational_stats(session, park_id: str, since: datetime) -> dict:
    reports = (
        await session.execute(
            text("SELECT COUNT(*) FROM field_reports WHERE deleted_at IS NULL AND created_at >= :since"),
            {"since": since},
        )
    ).scalar_one()

    tipoffs = (
        await session.execute(
            text("SELECT COUNT(*) FROM tipoffs WHERE deleted_at IS NULL AND created_at >= :since"),
            {"since": since},
        )
    ).scalar_one()

    active_rangers = (
        await session.execute(
            text("SELECT COUNT(*) FROM users WHERE role = 'ranger' AND is_active = true"),
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
