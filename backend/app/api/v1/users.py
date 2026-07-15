"""User profile endpoints for authenticated users."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    RoleChangeRequest,
    SetUsersStatusRequest,
    UpdateProfileRequest,
    UsersRequest,
    UsersResponse,
    UsersResultResponse,
)
from app.services.audit_service import AuditService
from app.services.user_service import UserService

router = APIRouter(tags=["users"])

@router.get("/users/me",
            response_model=UsersResponse,
            summary="Get the authenticated user's profile",
)
async def get_me(
        current_user: Annotated[
            User,
            Depends(get_current_user),
        ],
        db: Annotated[
            AsyncSession,
            Depends(get_db),
        ],
    ):
    service = UserService(UserRepository(db))
    user = service.get_me(current_user)
    return UsersResponse.model_validate(user)

@router.patch("/users/me",
              response_model=UsersResponse,
              summary="Update the authenticated user's profile",
)
async def update_me(
        body: UpdateProfileRequest,
        current_user: Annotated[
            User,
            Depends(get_current_user),
        ],
        db: Annotated[
            AsyncSession,
            Depends(get_db),
        ],
    ):
    service = UserService(UserRepository(db))
    user = await service.update_me(current_user, body)
    return UsersResponse.model_validate(user)


# Add exceptions here
@router.get(
    "/users",
    response_model=UsersResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Filter and get all user accounts",
)
async def users(
        req: Annotated[
            UsersRequest,
            Depends(),
        ],
        db: Annotated[
            AsyncSession,
            Depends(get_db),
        ],
        current_admin: Annotated[
            User,
            Depends(require_admin),
        ],
    ):
    repo = UserRepository(db)

    service = UserService(repo)

    response_data = await service.get_users(req)

    return response_data

@router.patch(
    "/users/{user_id}/status",
    response_model=UsersResponse,
    status_code=status.HTTP_200_OK,
    summary="Switch the selected users status",
)
async def status_switch(
        req: SetUsersStatusRequest,
        user_id: str,
        db: Annotated[
            AsyncSession,
            Depends(get_db),
        ],
        current_admin: Annotated[
            User,
            Depends(require_admin),
        ],
    ):
    repo = UserRepository(db)
    service = UserService(repo, AuditService(AuditRepository(db)))

    response_data = await service.switch_status(req.is_active, user_id, current_admin.id)

    if response_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User Id does not exist",
        )
    return response_data

@router.delete(
    "/admin/users/delete/{user_id}",
    response_model=UsersResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin deletes an account",
)
async def admin_delete_user(
        user_id: str,
        db: Annotated[
            AsyncSession,
            Depends(get_db),
        ],
        current_admin: Annotated[
            User,
            Depends(require_admin),
        ],
    ):
    repo=UserRepository(db)
    service = UserService(repo)

    response_data = await service.admin_delete(user_id)

    if response_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User Id does not exist",
        )
    return response_data

@router.patch(
    "/users/{user_id}/role",
    response_model=UsersResponse,
    status_code=status.HTTP_200_OK,
    summary="Change the role of a user",
)
async def change_user_role(
        req: RoleChangeRequest,
        user_id: str,
        db: Annotated[
            AsyncSession,
            Depends(get_db),
        ],
        current_admin: Annotated[
            User,
            Depends(require_admin),
        ],
    ):
    repo = UserRepository(db)
    service = UserService(repo)

    response_data = await service.change_role(user_id, req.new_role.value)

    if response_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User id does not exist",
        )
    return response_data
