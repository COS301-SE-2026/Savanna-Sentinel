from __future__ import annotations

from typing import Optional

from app.repositories.audit_repository import AuditRepository


class AuditService:
    def __init__(self, repo: AuditRepository):
        self.repo = repo

    async def log(
        self,
        actor_id: str,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        await self.repo.create(actor_id, action, target_type, target_id, details)