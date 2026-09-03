import json
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services.risk_service import (
    check_if_uploaded,
    delete_geojson_file,
    get_park_grid,
    validate_boundaries,
)


def test_get_park_grid_builds_response_from_repository():
    fake_cells = [
        {
            "cell_id": "cell-1",
            "row": 0,
            "col": 0,
            "corners": [
                (31.0, -24.3),
                (31.01, -24.3),
                (31.01, -24.31),
                (31.0, -24.31),
                (31.0, -24.3),
            ],
        },
    ]
    with patch(
        "app.services.risk_service.load_grid_geometry",
        return_value=fake_cells,
    ):
        response = get_park_grid()

    assert response.type == "FeatureCollection"
    assert len(response.features) == 1
    assert response.features[0].properties.cell_id == "cell-1"
    assert response.features[0].properties.row == 0
    assert response.features[0].geometry.coordinates == [
        fake_cells[0]["corners"],
    ]


@pytest.fixture
def sample_geojson():
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [36.8219, -1.2921],
                            [36.8329, -1.2921],
                            [36.8329, -1.2811],
                            [36.8219, -1.2811],
                            [36.8219, -1.2921],
                        ],
                    ],
                },
            },
        ],
    }
    return json.dumps(geojson_data).encode("utf-8")


# Various things need to be intercepted here
@patch("app.services.risk_service.invalidate_route_grid_cache")
@patch("app.services.risk_service.invalidate_grid_cache")
@patch("pathlib.Path.mkdir")
@patch("geopandas.GeoDataFrame.to_file", autospec=True)
def test_validate_boundaries_success(
    mock_to_file,
    mock_mkdir,
    mock_invalidate,
    mock_invalidate_route,
    sample_geojson,
):
    result = validate_boundaries(sample_geojson)

    written_gdf = mock_to_file.call_args[0][0]

    assert written_gdf.crs.to_epsg() == 32737

    # assert that the grid is in fact 1km x 1km cells
    for _, row in written_gdf.iterrows():
        assert (row["right"] - row["left"]) == 1000.0
        assert (row["top"] - row["bottom"]) == 1000.0
        assert row["left"] % 1000 == 0
        assert row["bottom"] % 1000 == 0

    required_cols = {
        "geometry",
        "left",
        "right",
        "top",
        "bottom",
        "row_index",
        "col_index",
        "id",
    }

    assert required_cols.issubset(set(written_gdf.columns))
    assert written_gdf["id"].iloc[0] == "cell-0"

    assert result["total_cells"] == len(written_gdf)
    mock_invalidate.assert_called_once()
    mock_invalidate_route.assert_called_once()


def test_validate_boundaries_invalid_file():
    bad_bytes = b"not a valid geojson file"

    with pytest.raises(HTTPException) as exc:
        validate_boundaries(bad_bytes)

    assert exc.value.status_code == 400


@patch("app.services.risk_service.invalidate_grid_cache")
@patch("pathlib.Path.mkdir")
@patch("geopandas.GeoDataFrame.to_file", autospec=True)
def test_validate_boundaries_out_of_bounds(
    mock_to_file,
    mock_mkdir,
    mock_invalidate,
):
    invalid_coords_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [200.0, -1.0],
                            [201.0, -1.0],
                            [201.0, 0.0],
                            [200.0, -1.0],
                        ],
                    ],
                },
            },
        ],
    }

    payload = json.dumps(invalid_coords_data).encode("utf-8")

    with pytest.raises(HTTPException) as exc:
        validate_boundaries(payload)

    assert exc.value.status_code == 422
    mock_to_file.assert_not_called()


@patch("pathlib.Path.is_file")
def test_check_if_uploaded_returns_true_when_file_exists(
    mock_is_file,
):
    mock_is_file.return_value = True
    result = check_if_uploaded()

    assert result is True


@patch("pathlib.Path.is_file")
def test_check_if_uploaded_returns_false_when_file_does_not_exist(
    mock_is_file,
):
    mock_is_file.return_value = False
    result = check_if_uploaded()

    assert result is False


@patch("app.services.risk_service.invalidate_route_grid_cache")
@patch("app.services.risk_service.invalidate_grid_cache")
@patch("pathlib.Path.unlink")
def test_delete_geojson_file_success(
    mock_unlink,
    mock_invalidate,
    mock_invalidate_route,
):
    result = delete_geojson_file()

    assert result is True
    mock_unlink.assert_called_once_with(missing_ok=True)
    mock_invalidate.assert_called_once()
    mock_invalidate_route.assert_called_once()


@patch("app.services.risk_service.invalidate_route_grid_cache")
@patch("app.services.risk_service.invalidate_grid_cache")
@patch("pathlib.Path.unlink")
def test_delete_geojson_file_failure(
    mock_unlink,
    mock_invalidate,
    mock_invalidate_route,
):
    mock_unlink.side_effect = PermissionError("Permission denied")

    result = delete_geojson_file()

    assert result is False
    mock_unlink.assert_called_once_with(missing_ok=True)
    mock_invalidate.assert_not_called()
    mock_invalidate_route.assert_not_called()
