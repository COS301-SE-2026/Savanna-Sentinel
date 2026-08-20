from __future__ import annotations

import csv
import io
import json
from typing import TYPE_CHECKING, Optional

from app.schemas.audit import AuditLogListResponse, AuditLogResponse

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.repositories.audit_repository import AuditRepository
    from app.repositories.user_repository import UserRepository
    from app.schemas.audit import AuditLogFilterRequest


class AuditService:
    def __init__(
        self, repo: AuditRepository, user_repo: UserRepository | None = None,
    ):
        self.repo = repo
        self.user_repo = user_repo

    async def log(
        self,
        actor_id: str,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        await self.repo.create(
            actor_id, action, target_type, target_id, details,
        )

    async def _resolve_row(self, r: AuditLog) -> dict:
        actor_username = (
            await self.user_repo.get_username_by_id(r.actor_id)
            if self.user_repo else None
        )
        target_username = None
        if self.user_repo and r.target_type == "user":
            target_username = await self.user_repo.get_username_by_id(
                r.target_id,
            )
        return {
            "id": r.id, "actor_id": r.actor_id,
            "actor_username": actor_username,
            "action": r.action, "target_type": r.target_type,
            "target_id": r.target_id, "target_username": target_username,
            "details": r.details, "created_at": r.created_at,
        }

    async def get_logs(
        self, req: AuditLogFilterRequest,
    ) -> AuditLogListResponse:
        results = await self.repo.list_logs(req)
        total = await self.repo.count_logs(req)

        responses = [
            AuditLogResponse(**await self._resolve_row(r)) for r in results
        ]

        return AuditLogListResponse(
            total=total, page=req.page, page_size=req.page_size,
            results=responses,
        )

    async def export_csv(self, req: AuditLogFilterRequest) -> str:
        rows = await self.repo.list_all_logs(req)

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "id", "actor_id", "actor_username", "action",
            "target_type", "target_id", "target_username",
            "details", "created_at",
        ])
        for r in rows:
            resolved = await self._resolve_row(r)
            writer.writerow([
                resolved["id"], resolved["actor_id"],
                resolved["actor_username"],
                resolved["action"], resolved["target_type"],
                resolved["target_id"],
                resolved["target_username"],
                json.dumps(resolved["details"]) if resolved["details"] else "",
                resolved["created_at"].isoformat(),
            ])
        return buffer.getvalue()
