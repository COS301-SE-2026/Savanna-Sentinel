from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.report import ReportUpdate
from app.schemas.sync import SyncReportItem, SyncResultItem

if TYPE_CHECKING:
    from app.models.user import User
    from app.repositories.report_repository import ReportRepository
    from app.services.report_service import ReportService


def _as_utc(value: datetime) -> datetime:
    """Timestamps are treated as UTC so the two sides compare."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class SyncService:
    def __init__(self, repo: ReportRepository, report_service: ReportService):
        self.repo = repo
        self.report_service = report_service

    async def sync_batch(
        self,
        current_user: "User",
        raw_reports: list,
    ) -> list[SyncResultItem]:
        """Each record is handled on its own."""
        results: list[SyncResultItem] = []
        for raw in raw_reports:
            results.append(await self._sync_one(current_user, raw))
        return results

    async def _sync_one(self, current_user: "User", raw) -> SyncResultItem:
        if not isinstance(raw, dict):
            return SyncResultItem(
                local_id="",
                status="error",
                message="Report entry must be an object",
            )

        local_id = raw.get("local_id")
        if not isinstance(local_id, str) or not local_id:
            return SyncResultItem(
                local_id="",
                status="error",
                message="local_id is required",
            )
        try:
            uuid.UUID(local_id)
        except ValueError:
            return SyncResultItem(
                local_id=local_id,
                status="error",
                message="local_id must be a UUID",
            )

        try:
            item = SyncReportItem.model_validate(raw)
        except ValidationError as exc:
            return SyncResultItem(
                local_id=local_id,
                status="error",
                message=_first_error(exc),
            )

        item.client_id = local_id

        try:
            existing = await self.repo.find_sync_target(
                current_user.id,
                local_id,
            )
            if item.deleted_at is not None:
                return await self._apply_delete(local_id, existing)
            if existing is None:
                return await self._apply_create(current_user, item, local_id)
            return await self._apply_update(
                current_user,
                item,
                local_id,
                existing,
            )
        except HTTPException as exc:
            return SyncResultItem(
                local_id=local_id,
                status="error",
                message=str(exc.detail),
            )

    async def _apply_delete(self, local_id: str, existing) -> SyncResultItem:
        if existing is None:
            return SyncResultItem(
                local_id=local_id,
                status="deleted",
                message="No server record to delete",
            )
        if existing["deleted_at"] is None:
            await self.repo.soft_delete(existing["report_id"])
        return SyncResultItem(
            local_id=local_id,
            report_id=existing["report_id"],
            status="deleted",
        )

    async def _apply_create(
        self,
        current_user: "User",
        item: SyncReportItem,
        local_id: str,
    ) -> SyncResultItem:
        created = await self.report_service.create_report(current_user, item)
        return SyncResultItem(
            local_id=local_id,
            report_id=created["report_id"],
            status="created",
        )

    async def _apply_update(
        self,
        current_user: "User",
        item: SyncReportItem,
        local_id: str,
        existing: dict,
    ) -> SyncResultItem:
        if _as_utc(item.occurred_at) <= _as_utc(existing["occurred_at"]):
            return SyncResultItem(
                local_id=local_id,
                report_id=existing["report_id"],
                status="conflict",
                message="Server copy is newer",
            )

        update = ReportUpdate(
            description=item.description,
            location=item.location,
            occurred_at=item.occurred_at,
            images=item.images,
            incident_type=item.incident_type,
            severity=item.severity,
            species=item.species,
            count=item.count,
        )
        await self.report_service.update_report(
            existing["report_id"],
            current_user,
            update,
        )
        return SyncResultItem(
            local_id=local_id,
            report_id=existing["report_id"],
            status="updated",
        )


def _first_error(exc: ValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid report"
    first = errors[0]
    location = ".".join(str(part) for part in first.get("loc", ()))
    return f"{location}: {first.get('msg', 'invalid')}".strip(": ")
