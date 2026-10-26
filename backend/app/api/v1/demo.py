from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.media import _service as media_service
from app.core.dependencies import get_db, require_roles
from app.models.user import User
from app.repositories.demo_repository import DemoRepository
from app.repositories.terrain_repository import TerrainRepository
from app.services.demo_service import DEMO_ADMIN_USERNAME, DemoService
from app.services.terrain_service import TerrainService

router = APIRouter(prefix="/demo", tags=["demo"])


def require_demo_admin(
    current_user: Annotated[User, Depends(require_roles(["admin"]))],
) -> User:
    if current_user.username != DEMO_ADMIN_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation forbidden: only {DEMO_ADMIN_USERNAME} "
            "can run demo actions",
        )
    return current_user


@router.post(
    "/reset",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset all data to the seed without reports, keeping admin1",
)
async def reset_demo(
    current_user: Annotated[User, Depends(require_demo_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await DemoService(DemoRepository(db), media_service).reset()


@router.post(
    "/workspace/klaserie",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Replace the workspace with the Klaserie demo layers",
)
async def insert_klaserie_workspace(
    current_user: Annotated[User, Depends(require_demo_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await DemoService(
        DemoRepository(db),
        media_service,
        TerrainService(TerrainRepository(db)),
    ).insert_klaserie_workspace(current_user.id)
