import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.risk import (
    ActiveModelResponse,
    CellExplainResponse,
    HeatmapResponse,
    HeatmapSnapshotListResponse,
    ParkGridResponse,
    RiskJobResponse,
    RiskScoreJobStatus,
    RiskTrainJobStatus,
    RiskTrainRequest,
)
from app.services.risk_service import (
    check_if_uploaded,
    delete_geojson_file,
    get_active_model_metrics,
    get_cell_explanation,
    get_heatmap,
    get_heatmap_snapshots,
    get_park_grid,
    get_scoring_job,
    get_training_job,
    trigger_scoring_job,
    trigger_training_job,
    validate_boundaries,
)

router = APIRouter(prefix="/risk", tags=["risk"])

_GRID_NOT_UPLOADED = "No park grid has been uploaded yet"


@router.get(
    "/grid",
    response_model=ParkGridResponse,
    summary="Get reprojected grid cell polygons for the park",
)
async def get_grid(current_user: Annotated[User, Depends(get_current_user)]):
    try:
        return get_park_grid()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_GRID_NOT_UPLOADED,
        ) from exc


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Allows a geojson to be uploaded to be used for parks",
)
async def upload_geojson(
    authenticated: Annotated[User, Depends(require_roles("admin"))],
    file: Annotated[UploadFile, File()],
):
    content = await file.read()

    validate_boundaries(content)


@router.get(
    "/initialise",
    status_code=status.HTTP_200_OK,
    summary="Returns a JSON determining if a geojson has been uploaded",
)
async def check_file(
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = check_if_uploaded()

    return {
        "uploaded": result,
    }


@router.delete(
    "/geojson",
    status_code=status.HTTP_200_OK,
    summary="Deletes the uploaded geojson in case the user is not satisfied",
)
async def delete_geojson(
    authenticated: Annotated[User, Depends(require_roles("admin"))],
):
    result = delete_geojson_file()

    return {
        "success": result,
    }


@router.post(
    "/train",
    response_model=RiskJobResponse,
    status_code=202,
    summary="Queue a risk model training job",
)
async def train_model_endpoint(
    request: RiskTrainRequest,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await trigger_training_job(db, request, current_user)


@router.get(
    "/train/{job_id}",
    response_model=RiskTrainJobStatus,
    summary="Get training job status/result",
)
async def get_train_job(
    job_id: str,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_training_job(db, job_id)


@router.post(
    "/score",
    response_model=RiskJobResponse,
    status_code=202,
    summary="Queue an ad-hoc risk scoring job",
)
async def score_endpoint(
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await trigger_scoring_job(db, current_user)


@router.get(
    "/score/{job_id}",
    response_model=RiskScoreJobStatus,
    summary="Get scoring job status/result",
)
async def get_score_job(
    job_id: str,
    current_user: Annotated[User, Depends(require_roles(["analyst", "admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_scoring_job(db, job_id)


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
    "/heatmap/snapshots",
    response_model=HeatmapSnapshotListResponse,
    summary="List every computed heatmap for the park, oldest first",
)
async def get_heatmap_snapshots_endpoint(
    current_user: Annotated[
        User,
        Depends(require_roles(["ranger", "analyst", "admin"])),
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_heatmap_snapshots(db)


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
