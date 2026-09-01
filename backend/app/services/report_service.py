from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException, status

from app.services.media_service import MediaService

if TYPE_CHECKING:
    from app.models.user import User
    from app.repositories.report_repository import ReportRepository
    from app.repositories.user_repository import UserRepository
    from app.schemas.report import ReportCreate, ReportUpdate
    from app.services.notification_service import NotificationService


class ReportService:
    def __init__(
        self,
        repo: ReportRepository,
        user_repo: UserRepository,
        media_service: Optional[MediaService] = None,
        notification_service: Optional["NotificationService"] = None,
    ):
        self.repo = repo
        self.user_repo = user_repo
        self.media_service = media_service or MediaService()
        self.notification_service = notification_service

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
        result = await self.repo.create(
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
        result["submitted_by_username"] = current_user.username

        if self.notification_service:
            await self.notification_service.notify_roles(
                ["analyst", "admin"],
                "field_report_submitted",
                f"New {data.report_type} field report",
                f"{current_user.username} submitted a {data.report_type} "
                f"report: {data.description[:120]}",
                related_type="field_report",
                related_id=result["report_id"],
            )

        return result

    async def update_report(
        self,
        report_id: str,
        current_user: "User",
        data: "ReportUpdate",
    ) -> Optional[dict]:
        provided = data.model_dump(exclude_unset=True)
        if not provided:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updatable fields provided",
            )

        existing = await self.repo.get_by_id(report_id)
        if existing is None:
            return None

        self._check_edit_permission(current_user, existing)
        fields = self._build_update_fields(
            existing["report_type"],
            data,
            provided,
        )

        result = await self.repo.update(
            report_id=report_id,
            report_type=existing["report_type"],
            fields=fields,
        )
        result[
            "submitted_by_username"
        ] = await self.user_repo.get_username_by_id(result["submitted_by"])
        return result

    async def delete_report(
        self,
        report_id: str,
        current_user: "User",
    ) -> bool:
        existing = await self.repo.get_by_id(report_id)
        if existing is None:
            return False

        self._check_edit_permission(current_user, existing)
        return await self.repo.soft_delete(report_id)

    def _check_edit_permission(
        self,
        current_user: "User",
        existing: dict,
    ) -> None:
        if (
            current_user.role == "ranger"
            and existing["submitted_by"] != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

    def _build_update_fields(
        self,
        report_type: str,
        data: "ReportUpdate",
        provided: dict,
    ) -> dict:
        fields: dict = {}

        if "description" in provided:
            fields["description"] = provided["description"]
        if "occurred_at" in provided:
            fields["occurred_at"] = self._validate_occurred_at(data.occurred_at)
        if "location" in provided:
            fields["location_wkt"] = self._validate_location(data.location)
        if "images" in provided:
            fields["images"] = provided["images"]
        if "status" in provided:
            fields["status"] = provided["status"]

        fields.update(self._type_specific_fields(report_type, provided))
        return fields

    def _validate_occurred_at(self, occurred: datetime) -> datetime:
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=timezone.utc)
        if occurred > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="occurred_at cannot be in the future",
            )
        return occurred

    def _validate_location(self, location) -> str:
        lat, lon = location.lat, location.lon
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="coordinates out of valid range",
            )
        return f"POINT({lon} {lat})"

    def _type_specific_fields(self, report_type: str, provided: dict) -> dict:
        fields: dict = {}
        if report_type == "incident":
            if "incident_type" in provided:
                fields["incident_type"] = provided["incident_type"]
            if "severity" in provided:
                fields["severity"] = provided["severity"]
        else:
            if "species" in provided:
                fields["species"] = provided["species"]
            if "count" in provided:
                fields["count"] = provided["count"]
        return fields

    async def get_reports(
        self,
        current_user: User,
        search: Optional[str] = None,
        report_types: Optional[list[str]] = None,
        severities: Optional[list[str]] = None,
        species: Optional[list[str]] = None,
        users: Optional[list[str]] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        sync_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        results, total = await self.repo.get_list(
            owner_id=None,
            search=search,
            report_types=report_types,
            severities=severities,
            species=species,
            users=users,
            from_dt=from_dt,
            to_dt=to_dt,
            sync_status=sync_status,
            page=page,
            page_size=page_size,
        )
        for item in results:
            item["images"] = self._view_urls(item.get("images"))
            item[
                "submitted_by_username"
            ] = await self.user_repo.get_username_by_id(item["submitted_by"])
        return results, total

    async def get_report(
        self,
        report_id: str,
        current_user: User,
    ) -> Optional[dict]:
        report = await self.repo.get_by_id(report_id)
        if report is None:
            return None
        report["images"] = self._view_urls(report.get("images"))
        report[
            "submitted_by_username"
        ] = await self.user_repo.get_username_by_id(report["submitted_by"])
        return report

    def _view_urls(self, images: Optional[list]) -> list:
        return [
            self.media_service.generate_view_url(url) for url in (images or [])
        ]

    async def get_species(
        self,
    ) -> list[str]:
        species = await self.repo.get_species()
        return species

    async def get_usernames(
        self,
    ) -> list[str]:
        species = await self.repo.get_usernames()
        return species
