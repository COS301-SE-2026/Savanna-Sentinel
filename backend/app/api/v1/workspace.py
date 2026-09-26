from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.models.user import User
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.workspace import (
    WorkspaceResponse,
    WorkspaceSaveRequest,
    WorkspaceVisibilityRequest,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(tags=["workspace"])

_workspace_user = require_roles(["analyst", "admin"])


@router.get(
    "/workspace",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_200_OK,
    summary="Load the shared geospatial workspace",
)
async def get_workspace(
    current_user: Annotated[User, Depends(_workspace_user)],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = WorkspaceService(WorkspaceRepository(db))
    return await service.get_workspace(current_user.id)


@router.put(
    "/workspace",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_200_OK,
    summary="Replace the shared geospatial workspace",
)
async def save_workspace(
    body: WorkspaceSaveRequest,
    current_user: Annotated[User, Depends(_workspace_user)],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = WorkspaceService(WorkspaceRepository(db))
    return await service.save_workspace(current_user.id, body)


@router.put(
    "/workspace/visibility",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Store the caller's own layer visibility",
)
async def set_workspace_visibility(
    body: WorkspaceVisibilityRequest,
    current_user: Annotated[User, Depends(_workspace_user)],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    service = WorkspaceService(WorkspaceRepository(db))
    await service.set_visibility(
        current_user.id,
        [entry.model_dump() for entry in body.entries],
    )
