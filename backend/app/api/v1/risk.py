import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.risk import (
    ActiveModelResponse,
    CellExplainResponse,
    HeatmapResponse,
    ParkGridResponse,
    RiskJobResponse,
    RiskScoreJobStatus,
    RiskTrainJobStatus,
    RiskTrainRequest,
)
from app.services.risk_service import (
    get_active_model_metrics,
    get_cell_explanation,
    get_heatmap,
    get_park_grid,
    get_scoring_job,
    get_training_job,
    trigger_scoring_job,
    trigger_training_job,
)

router = APIRouter(prefix="/risk", tags=["risk"])

_PARK_NOT_FOUND = "Park not found"


@router.get(
    "/grid",
    response_model=ParkGridResponse,
    summary="Get reprojected grid cell polygons for a park",
)
async def get_grid(
    current_user: Annotated[User, Depends(get_current_user)],
    # hardcode for now
    park_id: str = "klaserie",
):
    try:
        return get_park_grid(park_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_PARK_NOT_FOUND,
        ) from exc


@router.post(
    "/train",
    response_model=RiskJobResponse,
    status_code=202,
    summary="Queue a risk model training job",
)
async def train_model_endpoint(
    request: RiskTrainRequest,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
):
    return trigger_training_job(request, current_user)


@router.get(
    "/train/{job_id}",
    response_model=RiskTrainJobStatus,
    summary="Get training job status/result",
)
async def get_train_job(
    job_id: str,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
):
    return get_training_job(job_id)


@router.post(
    "/score",
    response_model=RiskJobResponse,
    status_code=202,
    summary="Queue an ad-hoc risk scoring job",
)
async def score_endpoint(
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
):
    return trigger_scoring_job(current_user)


@router.get(
    "/score/{job_id}",
    response_model=RiskScoreJobStatus,
    summary="Get scoring job status/result",
)
async def get_score_job(
    job_id: str,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
):
    return get_scoring_job(job_id)


@router.get(
    "/heatmap",
    response_model=HeatmapResponse,
    summary="Get a risk heatmap: latest, or a snapshot via date/snapshot",
)
async def get_heatmap_endpoint(
    current_user: Annotated[
        User,
        Depends(require_roles(["ranger", "analyst", "admin"])),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
    date: datetime | None = None,
    snapshot: uuid.UUID | None = None,
):
    return await get_heatmap(
        db,
        date=date,
        snapshot=str(snapshot) if snapshot else None,
    )


@router.get(
    "/heatmap/cells/{cell_id}/explain",
    response_model=CellExplainResponse,
    summary="Get top SHAP feature contributions for a cell's latest score",
)
async def explain_cell_endpoint(
    cell_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_cell_explanation(db, str(cell_id))


@router.get(
    "/models/active",
    response_model=ActiveModelResponse,
    summary="Get the active model's training window and performance metrics",
)
async def get_active_model_endpoint(
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_active_model_metrics(db)
