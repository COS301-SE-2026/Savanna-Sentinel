from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.repositories.terrain_repository import TerrainRepository
from app.schemas.terrain import TerrainEffectsResponse
from app.services.terrain_service import TerrainService

router = APIRouter(tags=["terrain"])


@router.get(
    "/terrain/risk-adjustments",
    response_model=TerrainEffectsResponse,
    status_code=status.HTTP_200_OK,
    summary="Per-cell risk adjustments from workspace terrain rules",
)
async def get_risk_adjustments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    return await TerrainService(TerrainRepository(db)).risk_adjustments()


@router.get(
    "/terrain/route-costs",
    response_model=TerrainEffectsResponse,
    status_code=status.HTTP_200_OK,
    summary="Per-cell route cost multipliers from workspace terrain rules",
)
async def get_route_costs(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    return await TerrainService(TerrainRepository(db)).route_costs()
