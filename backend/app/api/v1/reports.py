from datetime import datetime
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.user_repository import UserRepository
from app.schemas.report import (
    PostCommentRequest,
    ReportCommentResponse,
    ReportCreate,
    ReportListResponse,
    ReportResponse,
    ReportSubmitResponse,
    ReportUpdate,
    SpeciesResponse,
    StatusUpdateRequest,
    UserResponse,
)
from app.schemas.sync import SyncResponse
from app.services.comment_service import CommentService
from app.services.notification_service import NotificationService
from app.services.report_service import ReportService
from app.services.sync_service import SyncService

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

    service = ReportService(
        ReportRepository(db),
        UserRepository(db),
        notification_service=NotificationService(
            NotificationRepository(db),
            UserRepository(db),
        ),
    )
    result = await service.create_report(current_user, body)
    return ReportSubmitResponse(**result)


@router.post(
    "/reports/sync",
    response_model=SyncResponse,
    status_code=status.HTTP_207_MULTI_STATUS,
    summary="Batch sync offline reports (SC-28)",
)
async def sync_reports(
    body: Annotated[dict, Body()],
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("ranger", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    reports = body.get("reports")
    if not isinstance(reports, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reports must be an array",
        )

    repo = ReportRepository(db)
    service = SyncService(repo, ReportService(repo, UserRepository(db)))
    return SyncResponse(results=await service.sync_batch(current_user, reports))


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
    users: Annotated[
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
        users=users,
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
    user_repo = UserRepository(db)
    service = ReportService(repo, user_repo)

    species = await service.get_species()

    return SpeciesResponse(species=species)


@router.get(
    "/reports/users",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a list of usernames in the system to filter by",
)
async def get_usernames(
    is_authenticated: Annotated[
        User,
        Depends(require_roles(["admin", "analyst", "ranger"])),
    ],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    repo = ReportRepository(db)
    user_repo = UserRepository(db)
    service = ReportService(repo, user_repo)

    usernames = await service.get_usernames()

    return UserResponse(usernames=usernames)


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


@router.post(
    "/reports/{report_id}/comment",
    status_code=status.HTTP_201_CREATED,
    summary="Post a comment on the specified report",
)
async def post_comment(
    report_id: str,
    authenticated: Annotated[User, Depends(require_roles(["admin", "ranger"]))],
    comment: PostCommentRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = CommentService(db)

    return await service.post_comment(
        report_id=report_id,
        user=authenticated,
        payload=comment,
    )


@router.get(
    "/reports/{report_id}/comment",
    status_code=status.HTTP_200_OK,
    summary="Retrieve all posted comments",
    response_model=List[ReportCommentResponse],
)
async def get_comments(
    report_id: str,
    authenticated: Annotated[User, Depends(require_roles(["admin", "ranger"]))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = CommentService(db)

    result = await service.get_comments(report_id)

    return result


@router.post(
    "/reports/{report_id}/status/update",
    status_code=status.HTTP_200_OK,
    summary="Update a reports currently reported status",
)
async def update_report_status(
    report_id: str,
    payload: StatusUpdateRequest,
    authenticated: Annotated[User, Depends(require_roles(["admin", "ranger"]))],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = ReportService(ReportRepository(db), UserRepository(db))

    return await service.update_report(
        report_id=report_id,
        current_user=authenticated,
        data=ReportUpdate(status=payload.status),
    )
