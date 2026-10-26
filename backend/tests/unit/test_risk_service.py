import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services.risk_service import (
    check_if_uploaded,
    delete_park_grid,
    get_park_grid,
    get_risk_summary,
    upload_park_grid,
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
@patch("pathlib.Path.mkdir")
@patch("geopandas.GeoDataFrame.to_file", autospec=True)
def test_validate_boundaries_success(
    mock_to_file,
    mock_mkdir,
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


def test_validate_boundaries_invalid_file():
    bad_bytes = b"not a valid geojson file"

    with pytest.raises(HTTPException) as exc:
        validate_boundaries(bad_bytes)

    assert exc.value.status_code == 400


@patch("pathlib.Path.mkdir")
@patch("geopandas.GeoDataFrame.to_file", autospec=True)
def test_validate_boundaries_out_of_bounds(
    mock_to_file,
    mock_mkdir,
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


def _patch_grid_deletion(storage_keys, *, storage=None, unlink=None):
    """Patch everything delete_park_grid touches outside the service."""
    storage = storage or MagicMock()
    return (
        patch(
            "app.services.risk_service.risk_repository.delete_park_risk_data",
            AsyncMock(return_value=storage_keys),
        ),
        patch(
            "app.services.risk_service.RiskModelStorage",
            return_value=storage,
        ),
        patch("pathlib.Path.unlink", unlink or MagicMock()),
    )


@pytest.mark.asyncio
async def test_delete_park_grid_wipes_db_then_storage_then_file():
    storage = MagicMock()
    unlink = MagicMock()
    patches = _patch_grid_deletion(["k1", "k2"], storage=storage, unlink=unlink)
    with patches[0] as delete_data, patches[1], patches[2]:
        await delete_park_grid(MagicMock(), "admin-1", AsyncMock())

    delete_data.assert_awaited_once()
    assert [c.args[0] for c in storage.delete_model.call_args_list] == [
        "k1",
        "k2",
    ]
    unlink.assert_called_once_with(missing_ok=True)


@pytest.mark.asyncio
async def test_delete_park_grid_writes_audit_entry():
    audit = AsyncMock()
    patches = _patch_grid_deletion(["k1"])
    with patches[0], patches[1], patches[2]:
        await delete_park_grid(MagicMock(), "admin-1", audit)

    audit.log.assert_awaited_once_with(
        actor_id="admin-1",
        action="park_grid.deleted",
        target_type="park_grid",
        target_id=settings.PARK_ID,
    )


@pytest.mark.asyncio
async def test_delete_park_grid_skips_audit_when_file_delete_fails():
    audit = AsyncMock()
    unlink = MagicMock(side_effect=PermissionError("Permission denied"))
    patches = _patch_grid_deletion([], unlink=unlink)
    with (
        patches[0],
        patches[1],
        patches[2],
        pytest.raises(HTTPException),
    ):
        await delete_park_grid(MagicMock(), "admin-1", audit)

    audit.log.assert_not_awaited()


@pytest.mark.asyncio
async def test_upload_park_grid_writes_audit_entry_with_cell_count():
    audit = AsyncMock()
    with patch(
        "app.services.risk_service.validate_boundaries",
        return_value={"total_cells": 42},
    ):
        result = await upload_park_grid(b"{}", "admin-1", audit)

    assert result == {"total_cells": 42}
    audit.log.assert_awaited_once_with(
        actor_id="admin-1",
        action="park_grid.uploaded",
        target_type="park_grid",
        target_id=settings.PARK_ID,
        details={"total_cells": 42},
    )


@pytest.mark.asyncio
async def test_upload_park_grid_skips_audit_when_file_is_invalid():
    audit = AsyncMock()
    with pytest.raises(HTTPException):
        await upload_park_grid(b"not geojson", "admin-1", audit)

    audit.log.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_park_grid_continues_when_storage_delete_fails():
    storage = MagicMock()
    storage.delete_model.side_effect = RuntimeError("storage down")
    unlink = MagicMock()
    patches = _patch_grid_deletion(["k1", "k2"], storage=storage, unlink=unlink)
    with patches[0], patches[1], patches[2]:
        await delete_park_grid(MagicMock(), "admin-1", AsyncMock())

    assert storage.delete_model.call_count == 2
    unlink.assert_called_once_with(missing_ok=True)


@pytest.mark.asyncio
async def test_delete_park_grid_raises_500_when_file_delete_fails():
    unlink = MagicMock(side_effect=PermissionError("Permission denied"))
    patches = _patch_grid_deletion([], unlink=unlink)
    with (
        patches[0],
        patches[1],
        patches[2],
        pytest.raises(HTTPException) as exc_info,
    ):
        await delete_park_grid(MagicMock(), "admin-1", AsyncMock())

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_get_risk_summary_wraps_repo_counts_with_60d_and_7d_windows():
    with (
        patch(
            "app.services.risk_service.risk_repository.count_incidents_since",
            return_value=7,
        ) as mock_incidents,
        patch(
            "app.services.risk_service.risk_repository.count_sightings_since",
            return_value=42,
        ) as mock_sightings,
    ):
        response = await get_risk_summary(object())

    assert response.incidents_60d == 7
    assert response.sightings_7d == 42

    now = datetime.now(timezone.utc)
    incident_since = mock_incidents.call_args.args[1]
    sighting_since = mock_sightings.call_args.args[1]
    assert round((now - incident_since).total_seconds() / 86400) == 60
    assert round((now - sighting_since).total_seconds() / 86400) == 7
