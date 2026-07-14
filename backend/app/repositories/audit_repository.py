from __future__ import annotations
from typing import Optional
from app.models.audit_log import AuditLog

class AuditRepository:
    def __init__(self, db):
        if db is None:
            raise ValueError("AuditRepository needs an async database session")
        self.db = db

    async def create(
        self,
        actor_id: str,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry