from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException, status

from app.services.media_service import MediaService

if TYPE_CHECKING:
    from app.models.user import User
    from app.repositories.tipoff_repository import TipoffRepository
    from app.repositories.user_repository import UserRepository
    from app.schemas.tipoff import TipoffCreate
    from app.services.notification_service import NotificationService


class TipoffService:
    def __init__(
        self,
        repo: "TipoffRepository",
        user_repo: "UserRepository",
        media_service: Optional[MediaService] = None,
        notification_service: Optional["NotificationService"] = None,
    ):
        self.repo = repo
        self.user_repo = user_repo
        self.media_service = media_service or MediaService()
        self.notification_service = notification_service

    async def create_tipoff(
            self,
            current_user: "User",
            data: "TipoffCreate",
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
                detail="incident_type is required for incident tip-offs",
            )
        if data.report_type == "sighting" and not data.species:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="species is required for sighting tip-offs",
            )

        wkt = f"POINT({lon} {lat})"
        result = await self.repo.create(
            user_id=current_user.id,
            report_type=data.report_type,
            location_wkt=wkt,
            occurred_at=occurred,
            description=data.description,
            incident_type=data.incident_type,
            severity=data.severity,
            species=data.species,
            count=data.count,
            images=data.images,
        )
        result["submitted_by_username"] = current_user.username

        if self.notification_service:
            await self._notify_tipoff_submitted(current_user, data, result)

        return result

    async def _notify_tipoff_submitted(
        self,
        current_user: "User",
        data: "TipoffCreate",
        result: dict,
    ) -> None:
        subject = (
            data.incident_type
            if data.report_type == "incident"
            else data.species
        )
        await self.notification_service.notify_roles(
            ["ranger", "analyst", "admin"],
            "tipoff_submitted",
            f"New {data.report_type} tip-off",
            f"{current_user.username} reported {subject}: "
            f"{data.description[:120]}",
            related_type="tipoff",
            related_id=result["tipoff_id"],
        )

        if data.report_type == "incident" and data.severity == "high":
            await self.notification_service.notify_roles(
                ["ranger", "admin"],
                "high_severity_incident",
                "High-severity incident reported",
                f"{data.incident_type} reported by {current_user.username} "
                "- needs attention.",
                related_type="tipoff",
                related_id=result["tipoff_id"],
            )

    async def get_tipoffs(
        self,
        current_user: "User",
        report_type: Optional[str] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        owner_id = (
            current_user.id
            if current_user.role == "community_liaison"
            else None
        )
        results, total = await self.repo.get_list(
            owner_id=owner_id,
            report_type=report_type,
            from_dt=from_dt,
            to_dt=to_dt,
            page=page,
            page_size=page_size,
        )
        for item in results:
            item["images"] = self._view_urls(item.get("images"))
            item.setdefault("submitted_by_username", None)
        return results, total

    def _view_urls(self, images: Optional[list]) -> list:
        return [self.media_service.generate_view_url(u) for u in (images or [])]
