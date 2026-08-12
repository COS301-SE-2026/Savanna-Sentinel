from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User
from app.repositories.report_repository import ReportRepository
from app.repositories.user_repository import UserRepository
from app.schemas.report import (
    ReportCreate,
    ReportListResponse,
    ReportResponse,
    ReportSubmitResponse,
    ReportUpdate,
    SpeciesResponse,
)
from app.services.report_service import ReportService

router = APIRouter(tags=["reports"])

_ROLE_DENIED = "Access denied"
_REPORT_NOT_FOUND = "Report not found"


@router.post(
    "/reports",
    response_model=ReportSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit field report (SC-11)",
)
async def submit_report(
    body: ReportCreate,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("ranger", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = ReportService(ReportRepository(db), UserRepository(db))
    result = await service.create_report(current_user, body)
    return ReportSubmitResponse(**result)


@router.get(
    "/reports",
    response_model=ReportListResponse,
    status_code=status.HTTP_200_OK,
    summary="List field reports (SC-20)",
)
async def list_reports(
    search: Annotated[Optional[str], Query()] = None,
    report_type: Annotated[
        Optional[list[Literal["incident", "sighting"]]],
        Query(),
    ] = None,
    severity: Annotated[
        Optional[list[Literal["low", "medium", "high"]]],
        Query(),
    ] = None,
    species: Annotated[
        Optional[list[str]],
        Query(),
    ] = None,
    from_dt: Annotated[Optional[datetime], Query(alias="from")] = None,
    to: Annotated[Optional[datetime], Query()] = None,
    sync_status: Annotated[
        Optional[Literal["offline", "pending", "synced"]],
        Query(),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("ranger", "analyst", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = ReportService(ReportRepository(db), UserRepository(db))
    results, total = await service.get_reports(
        current_user=current_user,
        search=search,
        report_types=report_type,
        severities=severity,
        species=species,
        from_dt=from_dt,
        to_dt=to,
        sync_status=sync_status,
        page=page,
        page_size=page_size,
    )
    return ReportListResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=results,
    )


@router.patch(
    "/reports/{report_id}",
    response_model=ReportSubmitResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit field report (SC-12)",
)
async def update_report(
    report_id: str,
    body: ReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("ranger", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = ReportService(ReportRepository(db), UserRepository(db))
    result = await service.update_report(report_id, current_user, body)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_REPORT_NOT_FOUND,
        )

    return ReportSubmitResponse(**result)


@router.delete(
    "/reports/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete field report (SC-13)",
)
async def delete_report(
    report_id: str,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("ranger", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = ReportService(ReportRepository(db), UserRepository(db))
    deleted = await service.delete_report(report_id, current_user)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_REPORT_NOT_FOUND,
        )


@router.get(
    "/reports/species",
    response_model=SpeciesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a list of species in the system to filter by",
)
async def get_species(
    is_authenticated: Annotated[
        User,
        Depends(require_roles(["admin", "analyst", "ranger"])),
    ],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    repo = ReportRepository(db)
    service = ReportService(repo)

    species = await service.get_species()

    return SpeciesResponse(species=species)


@router.get(
    "/reports/{report_id}",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single field report by ID",
)
async def get_report(
    report_id: str,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("ranger", "analyst", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = ReportService(ReportRepository(db), UserRepository(db))
    report = await service.get_report(report_id, current_user)

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_REPORT_NOT_FOUND,
        )

    return ReportResponse(**report)
