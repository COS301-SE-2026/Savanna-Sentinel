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
from app.schemas.geo import GeoPolygon
from app.schemas.risk import (
    GridCellFeature,
    GridCellProperties,
    ParkGridResponse,
)


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
