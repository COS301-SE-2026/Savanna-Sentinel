from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException, status

if TYPE_CHECKING:
    from app.models.user import User
    from app.repositories.report_repository import ReportRepository
    from app.schemas.report import ReportCreate


class ReportService:
    def __init__(self, repo: ReportRepository):
        self.repo = repo

    async def create_report(
        self,
        current_user: "User",
        data: "ReportCreate",
    ) -> dict:
        now = datetime.now(timezone.utc)
        occurred = data.occurred_at
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=timezone.utc)
        if occurred > now:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="occurred_at cannot be in the future",
            )

        lat, lon = data.location.lat, data.location.lon
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="coordinates out of valid range",
            )

        if data.report_type == "incident" and not data.incident_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="incident_type is required for incident reports",
            )
        if data.report_type == "sighting" and not data.species:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="species is required for sighting reports",
            )

        wkt = f"POINT({lon} {lat})"
        return await self.repo.create(
            user_id=current_user.id,
            report_type=data.report_type,
            location_wkt=wkt,
            occurred_at=occurred,
            description=data.description,
            route_id=data.route_id,
            incident_type=data.incident_type,
            severity=data.severity,
            species=data.species,
            count=data.count,
            images=data.images,
        )

    async def get_reports(
        self,
        current_user: User,
        report_type: Optional[str] = None,
        severity: Optional[str] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        sync_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        owner_id = current_user.id if current_user.role == "ranger" else None
        return await self.repo.get_list(
            owner_id=owner_id,
            report_type=report_type,
            severity=severity,
            from_dt=from_dt,
            to_dt=to_dt,
            sync_status=sync_status,
            page=page,
            page_size=page_size,
        )

    async def get_report(
        self,
        report_id: str,
        current_user: User,
    ) -> Optional[dict]:
        report = await self.repo.get_by_id(report_id)
        if report is None:
            return None
        if (
            current_user.role == "ranger"
            and report["submitted_by"] != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        return report
