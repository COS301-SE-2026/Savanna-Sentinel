import io

import geopandas
from fastapi import HTTPException, status

from app.repositories.risk_repository import load_grid_geometry
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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format: {str(Exception)}",
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
        parsed.set_crs(espg=4326, inplace=True)

    
