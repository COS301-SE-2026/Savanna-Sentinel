import io
import math
from pathlib import Path

import geopandas
import numpy
from fastapi import HTTPException, status
from shapely.geometry import box

from app.repositories.risk_repository import (
    invalidate_grid_cache,
    load_grid_geometry,
)
import uuid
from datetime import datetime, timezone

from app.repositories import risk_repository
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


def validate_boundaries(file: bytes):
    try:
        parsed = geopandas.read_file(io.BytesIO(file))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format: {str(exc)}",
        ) from Exception

    minx, miny, maxx, maxy = parsed.total_bounds

    # Verify file is within bounds
    if not (
        -180 <= minx <= 180
        and -180 <= maxx <= 180
        and -90 <= miny <= 90
        and -90 <= maxy <= 90
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Boundary coordinates must follow WGS 84 standard "
            "(Otherwise known as Latitude, Longitude)",
        )

    if parsed.crs is None:
        parsed.set_crs(epsg=4326, inplace=True)

    center = parsed.geometry.union_all().centroid

    # Determine UTM Zone
    utm_zone = math.floor((center.x + 180) / 6) + 1
    if center.y >= 0:
        epsg_utm_zone = 32600 + utm_zone
    else:
        epsg_utm_zone = 32700 + utm_zone

    parsed_utm = parsed.to_crs(epsg=epsg_utm_zone)

    # Generate the grid to be used for the overlay later for intersection
    cell_size = 1000
    u_minx, u_miny, u_maxx, u_maxy = parsed_utm.total_bounds

    grid_minx = numpy.floor(u_minx / cell_size) * cell_size
    grid_miny = numpy.floor(u_miny / cell_size) * cell_size
    grid_maxx = numpy.ceil(u_maxx / cell_size) * cell_size
    grid_maxy = numpy.ceil(u_maxy / cell_size) * cell_size

    x_coords = numpy.arange(grid_minx, grid_maxx, cell_size)
    y_coords = numpy.arange(grid_miny, grid_maxy, cell_size)

    cells = []
    rows = []
    cols = []
    lefts, rights = [], []
    tops, bottoms = [], []

    for y_idx, y in enumerate(y_coords):
        for x_idx, x in enumerate(x_coords):
            cells.append(box(x, y, x + cell_size, y + cell_size))
            lefts.append(float(x))
            rights.append(float(x + cell_size))
            bottoms.append(float(y))
            tops.append(float(y + cell_size))
            rows.append(float(y_idx))
            cols.append(float(x_idx))

    grid = geopandas.GeoDataFrame(
        {
            "geometry": cells,
            "left": lefts,
            "right": rights,
            "top": tops,
            "bottom": bottoms,
            "row_index": rows,
            "col_index": cols,
        },
        crs=parsed_utm.crs,
    )

    # Generate the boundary
    boundary_outline = parsed_utm.union_all()
    full_blocks = grid[grid.intersects(boundary_outline)].copy()

    # Attach metadata for maplibre
    full_blocks["id"] = [f"cell-{i}" for i in range(len(full_blocks))]

    # Save to file
    output_file = Path("/app/app/data/reserve-grid.geojson")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    full_blocks.to_file(output_file, driver="GeoJSON")

    # Dev thing, clears the cache if the file is deleted and
    # recreated in the same session, should not be relevant in prod
    invalidate_grid_cache()

    return {
        "total_cells": len(full_blocks),
    }


def check_if_uploaded():
    return Path("/app/app/data/reserve-grid.geojson").is_file()


def delete_geojson_file():
    try:
        Path("/app/app/data/reserve-grid.geojson").unlink(missing_ok=True)
        invalidate_grid_cache()
    except Exception:
        return False

    return True
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
