from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import func, select

from app.models.audit_log import AuditLog

if TYPE_CHECKING:
    from app.schemas.audit import AuditLogFilterRequest


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

    def _apply_filters(self, stmt, req: AuditLogFilterRequest):
        if req.actor_id:
            stmt = stmt.where(AuditLog.actor_id == req.actor_id)
        if req.action:
            stmt = stmt.where(AuditLog.action == req.action)
        if req.target_type:
            stmt = stmt.where(AuditLog.target_type == req.target_type)
        return stmt

    async def list_logs(self, req: AuditLogFilterRequest) -> list[AuditLog]:
        stmt = self._apply_filters(select(AuditLog), req)
        stmt = (
            stmt.order_by(AuditLog.created_at.desc())
            .offset((req.page - 1) * req.page_size)
            .limit(req.page_size)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_logs(self, req: AuditLogFilterRequest) -> int:
        stmt = self._apply_filters(select(func.count(AuditLog.id)), req)
        result = await self.db.execute(stmt)
        return result.scalar_one()
