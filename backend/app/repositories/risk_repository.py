import json
import uuid
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from pyproj import Transformer
from sqlalchemy import column, insert, select, table, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk_model import RiskModel

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# hardcoded for now
_PARK_GRID_FILES = {
    "klaserie": _DATA_DIR / "reserve-grid.geojson",
    "reserve": _DATA_DIR / "reserve-grid.geojson",
}

_cell_risk_scores_table = table(
    "cell_risk_scores",
    column("id"),
    column("heatmap_id"),
    column("grid_cell_id"),
    column("risk_score"),
)
_grid_cell_features_table = table(
    "grid_cell_features",
    column("heatmap_id"),
    column("grid_cell_id"),
    column("features"),
)
_explainability_metrics_table = table(
    "explainability_metrics",
    column("cell_id"),
    column("key_reason"),
    column("confidence_level"),
)


@lru_cache(maxsize=None)
def load_grid_geometry(park_id: str) -> list[dict]:
    """Cell polygons for a reserve, reprojected to WGS84.

    Reads the grid file, returns each cell's 4 corners (for rendering) rather
    than just its center. The grid file itself is assumed to already exist in
    the park's local UTM zone.
    """
    grid_path = _PARK_GRID_FILES.get(park_id)
    if grid_path is None:
        raise ValueError(f"No grid data available for park_id={park_id!r}")

    with open(grid_path) as f:
        geojson = json.load(f)

    epsg_code = geojson["crs"]["properties"]["name"].rsplit(":", 1)[-1]
    to_wgs84 = Transformer.from_crs(
        f"EPSG:{epsg_code}",
        "EPSG:4326",
        always_xy=True,
    )

    cells = []
    for feature in geojson["features"]:
        props = feature["properties"]
        left, right = props["left"], props["right"]
        top, bottom = props["top"], props["bottom"]
        corners_xy = [
            (left, top),
            (right, top),
            (right, bottom),
            (left, bottom),
            (left, top),
        ]

        raw_id = str(props["id"]).replace("cell-", "")
        cell_id = f"cell-{int(float(raw_id))}"

        corners = [to_wgs84.transform(x, y) for x, y in corners_xy]
        cells.append(
            {
                "cell_id": cell_id,
                "row": int(props["row_index"]),
                "col": int(props["col_index"]),
                "corners": corners,
            },
        )
    return cells


def invalidate_grid_cache() -> None:
    load_grid_geometry.cache_clear()
async def save_model_version(
    session: AsyncSession,
    park_id: str,
    object_storage_key: str,
    trained_by: str,
    window_start: str | datetime,
    window_end: str | datetime,
    n_examples: int,
    metrics: dict,
) -> str:
    if isinstance(window_start, str):
        window_start = datetime.fromisoformat(window_start)
    if isinstance(window_end, str):
        window_end = datetime.fromisoformat(window_end)

    await session.execute(
        update(RiskModel)
        .where(RiskModel.park_id == park_id, RiskModel.is_active.is_(True))
        .values(is_active=False),
    )
    new_model = RiskModel(
        park_id=park_id,
        object_storage_key=object_storage_key,
        is_active=True,
        trained_by=trained_by,
        training_window_start=window_start,
        training_window_end=window_end,
        n_training_examples=n_examples,
        metrics=metrics,
    )
    session.add(new_model)
    await session.flush()
    return new_model.id


async def get_active_model(
    session: AsyncSession,
    park_id: str,
) -> RiskModel | None:
    result = await session.execute(
        select(RiskModel).where(
            RiskModel.park_id == park_id,
            RiskModel.is_active.is_(True),
        ),
    )
    return result.scalar_one_or_none()


async def persist_grid_cells(session: AsyncSession, park_id: str) -> None:
    cells = load_grid_geometry(park_id)
    for cell in cells:
        ring_wkt = ", ".join(f"{lon} {lat}" for lon, lat in cell["corners"])
        polygon_wkt = f"POLYGON(({ring_wkt}))"
        await session.execute(
            text("""
                INSERT INTO grid_cells
                    (park_id, cell_ref, row_index, col_index, polygon_bounds)
                VALUES
                    (:park_id, :cell_ref, :row_index, :col_index,
                     ST_GeogFromText(:wkt))
                ON CONFLICT (park_id, cell_ref) DO NOTHING
            """),
            {
                "park_id": park_id,
                "cell_ref": cell["cell_id"],
                "row_index": cell["row"],
                "col_index": cell["col"],
                "wkt": polygon_wkt,
            },
        )


async def get_grid_cells(session: AsyncSession, park_id: str) -> list[dict]:
    result = await session.execute(
        text("""
            SELECT id, row_index, col_index,
                ST_AsGeoJSON(polygon_bounds) AS geojson
            FROM grid_cells
            WHERE park_id = :park_id
        """),
        {"park_id": park_id},
    )
    cells = []
    for row in result.fetchall():
        geometry = json.loads(row.geojson)
        cells.append(
            {
                "cell_id": str(row.id),
                "row": row.row_index,
                "col": row.col_index,
                "corners": [
                    tuple(coord) for coord in geometry["coordinates"][0]
                ],
            },
        )
    return cells


async def fetch_incidents_by_cell(
    session: AsyncSession,
    park_id: str,
    since: datetime,
) -> dict[str, list[dict]]:
    result = await session.execute(
        text("""
            SELECT
                gc.id AS cell_id,
                ge.occurred_at,
                i.severity,
                CASE
                    WHEN i.field_report_id IS NOT NULL THEN 'field_report'
                    ELSE 'tipoff'
                END AS source_tier
            FROM incidents i
            JOIN geospatial_events ge ON ge.id = i.id
            JOIN grid_cells gc
                ON gc.park_id = :park_id
                AND ST_Contains(
                    gc.polygon_bounds::geometry, ge.location::geometry
                )
            WHERE ge.occurred_at >= :since
        """),
        {"park_id": park_id, "since": since},
    )
    by_cell: dict[str, list[dict]] = {}
    for row in result.fetchall():
        by_cell.setdefault(str(row.cell_id), []).append(
            {
                "occurred_at": row.occurred_at,
                "severity": row.severity,
                "source_tier": row.source_tier,
            },
        )
    return by_cell


async def fetch_patrol_tracks_by_cell(
    session: AsyncSession,
    park_id: str,
    since: datetime,
) -> dict[str, list[datetime]]:
    result = await session.execute(
        text("""
            SELECT gc.id AS cell_id, ge.occurred_at
            FROM patrol_tracks pt
            JOIN geospatial_events ge ON ge.id = pt.id
            JOIN grid_cells gc
                ON gc.park_id = :park_id
                AND ST_Intersects(
                    gc.polygon_bounds::geometry, pt.route_line::geometry
                )
            WHERE ge.occurred_at >= :since
        """),
        {"park_id": park_id, "since": since},
    )
    by_cell: dict[str, list[datetime]] = {}
    for row in result.fetchall():
        by_cell.setdefault(str(row.cell_id), []).append(row.occurred_at)
    return by_cell


async def save_heatmap_snapshot(
    session: AsyncSession,
    model_id: str,
    cells: list[dict],
    scores: dict[str, float],
    features_per_cell: dict[str, dict[str, float]],
    explanations: dict[str, list[tuple[str, float]]],
    time_interval: str = "6h",
) -> tuple[str, datetime]:
    heatmap_result = await session.execute(
        text("""
            INSERT INTO risk_heatmaps (model_id, grid_resolution, time_interval)
            VALUES (:model_id, '1km', :time_interval)
            RETURNING id, computed_at
        """),
        {"model_id": model_id, "time_interval": time_interval},
    )
    heatmap_row = heatmap_result.fetchone()
    heatmap_id = str(heatmap_row.id)
    computed_at = heatmap_row.computed_at

    score_rows = []
    feature_rows = []
    explain_rows = []
    for cell in cells:
        cell_id = cell["cell_id"]
        if cell_id not in scores:
            continue

        score_row_id = str(uuid.uuid4())
        score_rows.append(
            {
                "id": score_row_id,
                "heatmap_id": heatmap_id,
                "grid_cell_id": cell_id,
                "risk_score": scores[cell_id],
            },
        )
        feature_rows.append(
            {
                "heatmap_id": heatmap_id,
                "grid_cell_id": cell_id,
                "features": json.dumps(features_per_cell[cell_id]),
            },
        )
        for feature_name, contribution in explanations.get(cell_id, []):
            explain_rows.append(
                {
                    "cell_id": score_row_id,
                    "key_reason": feature_name,
                    "confidence_level": contribution,
                },
            )

    if score_rows:
        await session.execute(insert(_cell_risk_scores_table), score_rows)
    if feature_rows:
        await session.execute(insert(_grid_cell_features_table), feature_rows)
    if explain_rows:
        await session.execute(
            insert(_explainability_metrics_table),
            explain_rows,
        )

    return heatmap_id, computed_at


async def _assemble_heatmap(
    session: AsyncSession,
    heatmap_id,
    computed_at,
) -> dict:
    cells_result = await session.execute(
        text("""
            SELECT gc.id AS cell_id, crs.risk_score,
                ST_AsGeoJSON(gc.polygon_bounds) AS geojson
            FROM cell_risk_scores crs
            JOIN grid_cells gc ON gc.id = crs.grid_cell_id
            WHERE crs.heatmap_id = :heatmap_id
        """),
        {"heatmap_id": heatmap_id},
    )
    cells = []
    for row in cells_result.fetchall():
        geometry = json.loads(row.geojson)
        cells.append(
            {
                "cell_id": str(row.cell_id),
                "risk_score": row.risk_score,
                "corners": [
                    tuple(coord) for coord in geometry["coordinates"][0]
                ],
            },
        )

    return {
        "heatmap_id": str(heatmap_id),
        "computed_at": computed_at.isoformat(),
        "cells": cells,
    }


async def get_latest_heatmap(
    session: AsyncSession,
    park_id: str,
) -> dict | None:
    heatmap_result = await session.execute(
        text("""
            SELECT rh.id, rh.computed_at
            FROM risk_heatmaps rh
            JOIN risk_models rm ON rm.id = rh.model_id
            WHERE rm.park_id = :park_id
            ORDER BY rh.computed_at DESC
            LIMIT 1
        """),
        {"park_id": park_id},
    )
    heatmap_row = heatmap_result.fetchone()
    if heatmap_row is None:
        return None
    return await _assemble_heatmap(
        session,
        heatmap_row.id,
        heatmap_row.computed_at,
    )


async def get_heatmap_by_id(
    session: AsyncSession,
    heatmap_id: str,
    park_id: str,
) -> dict | None:
    heatmap_result = await session.execute(
        text("""
            SELECT rh.id, rh.computed_at
            FROM risk_heatmaps rh
            JOIN risk_models rm ON rm.id = rh.model_id
            WHERE rh.id = :heatmap_id AND rm.park_id = :park_id
        """),
        {"heatmap_id": heatmap_id, "park_id": park_id},
    )
    heatmap_row = heatmap_result.fetchone()
    if heatmap_row is None:
        return None
    return await _assemble_heatmap(
        session,
        heatmap_row.id,
        heatmap_row.computed_at,
    )


async def get_heatmap_at_or_before(
    session: AsyncSession,
    park_id: str,
    date: datetime,
) -> dict | None:
    heatmap_result = await session.execute(
        text("""
            SELECT rh.id, rh.computed_at
            FROM risk_heatmaps rh
            JOIN risk_models rm ON rm.id = rh.model_id
            WHERE rm.park_id = :park_id AND rh.computed_at <= :date
            ORDER BY rh.computed_at DESC
            LIMIT 1
        """),
        {"park_id": park_id, "date": date},
    )
    heatmap_row = heatmap_result.fetchone()
    if heatmap_row is None:
        return None
    return await _assemble_heatmap(
        session,
        heatmap_row.id,
        heatmap_row.computed_at,
    )


async def get_cell_explanation(
    session: AsyncSession,
    cell_id: str,
) -> dict | None:
    result = await session.execute(
        text("""
            SELECT crs.heatmap_id, em.key_reason, em.confidence_level
            FROM cell_risk_scores crs
            JOIN risk_heatmaps rh ON rh.id = crs.heatmap_id
            JOIN explainability_metrics em ON em.cell_id = crs.id
            WHERE crs.grid_cell_id = :cell_id
            ORDER BY rh.computed_at DESC, em.confidence_level DESC
        """),
        {"cell_id": cell_id},
    )
    rows = result.fetchall()
    if not rows:
        return None

    latest_heatmap_id = str(rows[0].heatmap_id)
    top_features = [
        {"feature_name": row.key_reason, "contribution": row.confidence_level}
        for row in rows
        if str(row.heatmap_id) == latest_heatmap_id
    ]
    return {"heatmap_id": latest_heatmap_id, "top_features": top_features}


async def get_active_model_details(
    session: AsyncSession,
    park_id: str,
) -> dict | None:
    model = await get_active_model(session, park_id)
    if model is None:
        return None
    return {
        "model_id": model.id,
        "trained_at": model.trained_at.isoformat(),
        "training_window_start": model.training_window_start.isoformat(),
        "training_window_end": model.training_window_end.isoformat(),
        "n_training_examples": model.n_training_examples,
        "metrics": model.metrics,
    }


def risk_level_for_score(risk_score: float) -> str:
    if risk_score >= 0.75:
        return "Critical"
    if risk_score >= 0.5:
        return "High"
    if risk_score >= 0.25:
        return "Medium"
    return "Low"


async def get_risk_zone_overview(
    session: AsyncSession,
    park_id: str,
    limit: int = 5,
) -> list[dict]:
    heatmap_row = (
        await session.execute(
            text("""
                SELECT rh.id
                FROM risk_heatmaps rh
                JOIN risk_models rm ON rm.id = rh.model_id
                WHERE rm.park_id = :park_id
                ORDER BY rh.computed_at DESC
                LIMIT 1
            """),
            {"park_id": park_id},
        )
    ).fetchone()
    if heatmap_row is None:
        return []

    rows = (
        await session.execute(
            text("""
                SELECT gc.row_index AS row_index, gc.col_index AS col_index,
                    crs.risk_score
                FROM cell_risk_scores crs
                JOIN grid_cells gc ON gc.id = crs.grid_cell_id
                WHERE crs.heatmap_id = :heatmap_id
                ORDER BY crs.risk_score DESC
                LIMIT :limit
            """),
            {"heatmap_id": heatmap_row.id, "limit": limit},
        )
    ).fetchall()

    return [
        {
            "zone": f"Zone {row.row_index + 1}-{row.col_index + 1}",
            "level": risk_level_for_score(row.risk_score),
            "risk_score": row.risk_score,
        }
        for row in rows
    ]
