import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.repositories import risk_repository
from app.repositories.risk_repository import load_grid_geometry
from app.schemas.geo import GeoPolygon
from app.schemas.risk import (
    ActiveModelResponse,
    CellExplainResponse,
    ExplainFeature,
    GridCellFeature,
    GridCellProperties,
    HeatmapCell,
    HeatmapResponse,
    ParkGridResponse,
    RiskJobResponse,
    RiskScoreJobStatus,
    RiskTrainJobStatus,
    RiskTrainRequest,
)
from app.workers.celery_app import celery_app
from app.workers.tasks.risk_tasks import (
    run_risk_scoring_job,
    run_risk_training_job,
)

_CELERY_STATUS_MAP = {
    "PENDING": "queued",
    "RECEIVED": "queued",
    "STARTED": "processing",
    "RETRY": "processing",
    "SUCCESS": "completed",
    "FAILURE": "failed",
}


def get_park_grid(park_id: str) -> ParkGridResponse:
    cells = load_grid_geometry(park_id)
    features = [
        GridCellFeature(
            properties=GridCellProperties(
                cell_id=cell["cell_id"],
                row=cell["row"],
                col=cell["col"],
            ),
            geometry=GeoPolygon(coordinates=[cell["corners"]]),
        )
        for cell in cells
    ]
    return ParkGridResponse(features=features)


def trigger_training_job(request: RiskTrainRequest, user) -> RiskJobResponse:
    job_id = str(uuid.uuid4())
    run_risk_training_job.apply_async(
        kwargs={
            "park_id": "klaserie",
            "window_start": request.window_start.isoformat(),
            "window_end": request.window_end.isoformat(),
            "triggered_by": user.id,
        },
        task_id=job_id,
    )
    return RiskJobResponse(
        job_id=job_id,
        status="queued",
        queued_at=datetime.now(timezone.utc).isoformat(),
    )


def get_training_job(job_id: str) -> RiskTrainJobStatus:
    result = celery_app.AsyncResult(job_id)
    status = _CELERY_STATUS_MAP.get(result.state, result.state.lower())

    payload = result.result if result.state == "SUCCESS" else None
    return RiskTrainJobStatus(
        job_id=job_id,
        status=status if payload is None else payload.get("status", status),
        model_id=payload.get("model_id") if payload else None,
        metrics=payload.get("metrics") if payload else None,
        n_training_examples=(
            payload.get("n_training_examples") if payload else None
        ),
    )


def trigger_scoring_job(user) -> RiskJobResponse:
    job_id = str(uuid.uuid4())
    run_risk_scoring_job.apply_async(
        kwargs={"park_id": "klaserie", "triggered_manually": True},
        task_id=job_id,
    )
    return RiskJobResponse(
        job_id=job_id,
        status="queued",
        queued_at=datetime.now(timezone.utc).isoformat(),
    )


def get_scoring_job(job_id: str) -> RiskScoreJobStatus:
    result = celery_app.AsyncResult(job_id)
    status = _CELERY_STATUS_MAP.get(result.state, result.state.lower())

    payload = result.result if result.state == "SUCCESS" else None
    return RiskScoreJobStatus(
        job_id=job_id,
        status=status if payload is None else payload.get("status", status),
        heatmap_id=payload.get("heatmap_id") if payload else None,
        computed_at=payload.get("computed_at") if payload else None,
        n_cells_scored=payload.get("n_cells_scored") if payload else None,
    )


_PARK_ID = "klaserie"


async def get_heatmap(
    session,
    date: datetime | None = None,
    snapshot: str | None = None,
) -> HeatmapResponse:
    if date is not None and snapshot is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="provide at most one of date or snapshot",
        )

    if snapshot is not None:
        data = await risk_repository.get_heatmap_by_id(
            session,
            snapshot,
            _PARK_ID,
        )
    elif date is not None:
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        data = await risk_repository.get_heatmap_at_or_before(
            session,
            _PARK_ID,
            date,
        )
    else:
        data = await risk_repository.get_latest_heatmap(session, _PARK_ID)

    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No heatmap has been computed yet",
        )

    return HeatmapResponse(
        heatmap_id=data["heatmap_id"],
        computed_at=data["computed_at"],
        cells=[
            HeatmapCell(
                cell_id=cell["cell_id"],
                risk_score=cell["risk_score"],
                geometry=GeoPolygon(coordinates=[cell["corners"]]),
            )
            for cell in data["cells"]
        ],
    )


async def get_cell_explanation(session, cell_id: str) -> CellExplainResponse:
    data = await risk_repository.get_cell_explanation(session, cell_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No explanation available for this cell",
        )

    return CellExplainResponse(
        cell_id=cell_id,
        heatmap_id=data["heatmap_id"],
        top_features=[
            ExplainFeature(**feature) for feature in data["top_features"]
        ],
    )


async def get_active_model_metrics(session) -> ActiveModelResponse:
    data = await risk_repository.get_active_model_details(session, _PARK_ID)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No trained model exists yet",
        )

    return ActiveModelResponse(**data)
