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
