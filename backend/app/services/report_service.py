from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status

from app.models.user import User
from app.repositories.report_repository import ReportRepository


class ReportService:
    def __init__(self, repo: ReportRepository):
        self.repo = repo

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
