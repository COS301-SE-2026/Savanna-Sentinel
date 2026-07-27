from app.schemas.geo import GeoPolygon
from app.schemas.risk import (
    GridCellFeature,
    GridCellProperties,
    ParkGridResponse,
)


def _ring():
    return [
        (31.0, -24.3),
        (31.01, -24.3),
        (31.01, -24.31),
        (31.0, -24.31),
        (31.0, -24.3),
    ]


def test_geo_polygon_holds_a_single_ring_of_coordinates():
    polygon = GeoPolygon(coordinates=[_ring()])
    assert polygon.type == "Polygon"
    assert len(polygon.coordinates[0]) == 5


def test_park_grid_response_builds_from_features():
    feature = GridCellFeature(
        properties=GridCellProperties(cell_id="cell-1", row=0, col=0),
        geometry=GeoPolygon(coordinates=[_ring()]),
    )
    response = ParkGridResponse(features=[feature])
    assert response.type == "FeatureCollection"
    assert response.features[0].properties.cell_id == "cell-1"
    assert response.features[0].geometry.type == "Polygon"
