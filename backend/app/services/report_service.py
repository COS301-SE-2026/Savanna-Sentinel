from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status

from app.models.user import User
from app.repositories.report_repository import ReportRepository


class ReportService:
    def __init__(self, repo: ReportRepository):
        self.repo = repo

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

    async def get_report(self, report_id: str, current_user: User) -> Optional[dict]:
        report = await self.repo.get_by_id(report_id)
        if report is None:
            return None
        if current_user.role == "ranger" and report["submitted_by"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        return report
