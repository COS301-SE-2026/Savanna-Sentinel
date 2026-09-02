from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.route_job import RouteJob

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def create_route_job(
    session: AsyncSession,
    job_id: str,
    park_id: str,
    requested_by: str,
) -> None:
    session.add(
        RouteJob(id=job_id, park_id=park_id, requested_by=requested_by),
    )
    await session.commit()


async def route_job_exists_for_user(
    session: AsyncSession,
    job_id: str,
    user_id: str,
) -> bool:
    try:
        uuid.UUID(job_id)
    except ValueError:
        return False

    result = await session.execute(
        select(RouteJob.id).where(
            RouteJob.id == job_id,
            RouteJob.requested_by == user_id,
        ),
    )
    return result.scalar_one_or_none() is not None
