from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.tipoff_repository import TipoffRepository
from app.repositories.user_repository import UserRepository
from app.schemas.report import SpeciesResponse, UserResponse
from app.schemas.tipoff import (
    TipoffCreate,
    TipoffListResponse,
    TipoffSubmitResponse,
)
from app.services.notification_service import NotificationService
from app.services.tipoff_service import TipoffService

router = APIRouter(tags=["tipoff"])

_ROLE_DENIED = "Access denied"


@router.post(
    "/tipoffs",
    response_model=TipoffSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="submit tipoff (SC-14)",
)
async def submit_tipoff(
    body: TipoffCreate,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in ("community_liaison", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = TipoffService(
        TipoffRepository(db),
        UserRepository(db),
        notification_service=NotificationService(
            NotificationRepository(db),
            UserRepository(db),
        ),
    )
    result = await service.create_tipoff(current_user, body)
    return TipoffSubmitResponse(**result)


@router.get(
    "/tipoffs",
    response_model=TipoffListResponse,
    status_code=status.HTTP_200_OK,
    summary="List tipoffs (SC-27)",
)
async def list_tipoffs(
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
    sort_by: Annotated[
        Optional[
            Literal[
                "report_type",
                "description",
                "occurred_at",
                "submitted_by",
                "created_at",
            ]
        ],
        Query(alias="sort"),
    ] = None,
    direction: Annotated[Optional[Literal["asc", "desc"]], Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    if current_user.role not in (
        "community_liaison",
        "ranger",
        "analyst",
        "admin",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_ROLE_DENIED,
        )

    service = TipoffService(TipoffRepository(db), UserRepository(db))
    results, total = await service.get_tipoffs(
        current_user=current_user,
        search=search,
        report_types=report_type,
        severities=severity,
        species=species,
        users=users,
        from_dt=from_dt,
        to_dt=to,
        sort_by=sort_by,
        direction=direction,
        page=page,
        page_size=page_size,
    )

    return TipoffListResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=results,
    )


@router.get(
    "/tipoffs/species",
    response_model=SpeciesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a list of species in tip-offs to filter by",
)
async def get_tipoff_species(
    is_authenticated: Annotated[
        User,
        Depends(
            require_roles(["admin", "analyst", "ranger", "community_liaison"]),
        ),
    ],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = TipoffService(TipoffRepository(db), UserRepository(db))
    return SpeciesResponse(species=await service.get_species())


@router.get(
    "/tipoffs/users",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a list of usernames that submitted tip-offs to filter by",
)
async def get_tipoff_usernames(
    is_authenticated: Annotated[
        User,
        Depends(
            require_roles(["admin", "analyst", "ranger", "community_liaison"]),
        ),
    ],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = TipoffService(TipoffRepository(db), UserRepository(db))
    return UserResponse(usernames=await service.get_usernames())
