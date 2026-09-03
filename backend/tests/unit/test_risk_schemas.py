from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.geo import GeoPolygon
from app.schemas.risk import (
    GridCellFeature,
    GridCellProperties,
    ParkGridResponse,
    RiskTrainRequest,
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


def test_train_request_accepts_valid_window():
    now = datetime.now(timezone.utc)
    req = RiskTrainRequest(
        window_start=now - timedelta(days=90),
        window_end=now - timedelta(days=1),
    )
    assert req.window_end > req.window_start


def test_train_request_rejects_end_before_start():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        RiskTrainRequest(
            window_start=now,
            window_end=now - timedelta(days=1),
        )


def test_train_request_rejects_future_end():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        RiskTrainRequest(
            window_start=now - timedelta(days=10),
            window_end=now + timedelta(days=1),
        )


def test_train_request_accepts_naive_datetimes_as_utc():
    now = datetime.now(timezone.utc)
    req = RiskTrainRequest(
        window_start=(now - timedelta(days=10)).replace(tzinfo=None),
        window_end=(now - timedelta(days=1)).replace(tzinfo=None),
    )
    assert req.window_start.tzinfo is not None
    assert req.window_end.tzinfo is not None
    assert req.window_end > req.window_start


def test_train_request_allows_missing_window_start():
    now = datetime.now(timezone.utc)
    req = RiskTrainRequest(window_end=now - timedelta(days=1))

    assert req.window_start is None
    assert req.window_end == now - timedelta(days=1)


def test_train_request_defaults_window_end_to_now_when_omitted():
    req = RiskTrainRequest()

    assert req.window_start is None
    assert req.window_end is not None
    assert req.window_end <= datetime.now(timezone.utc)
