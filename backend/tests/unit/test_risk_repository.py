import json

import pytest
from pyproj import Transformer

from app.repositories import risk_repository
from app.repositories.risk_repository import (
    invalidate_grid_cache,
    load_grid_geometry,
)

_EPSG = 32736
_CELL_M = 1000.0
_BASE_LEFT = 317527.85260646814
_BASE_TOP = 7315330.772710353


def _cell(cell_id, row, col):
    left = _BASE_LEFT + col * _CELL_M
    top = _BASE_TOP - row * _CELL_M
    return {
        "type": "Feature",
        "properties": {
            "id": float(cell_id),
            "left": left,
            "top": top,
            "right": left + _CELL_M,
            "bottom": top - _CELL_M,
            "row_index": float(row),
            "col_index": float(col),
        },
    }


def _write_grid(tmp_path, cells):
    geojson = {
        "type": "FeatureCollection",
        "name": "test_grid",
        "crs": {
            "type": "name",
            "properties": {"name": f"urn:ogc:def:crs:EPSG::{_EPSG}"},
        },
        "features": cells,
    }
    path = tmp_path / "grid.geojson"
    path.write_text(json.dumps(geojson))
    return path


@pytest.fixture
def grid_2x2(tmp_path, monkeypatch):
    cells = [
        _cell(1, row=0, col=0),
        _cell(2, row=0, col=1),
        _cell(3, row=1, col=0),
        _cell(4, row=1, col=1),
    ]
    path = _write_grid(tmp_path, cells)
    park_id = "unit-test-2x2"
    monkeypatch.setitem(risk_repository._PARK_GRID_FILES, park_id, path)
    load_grid_geometry.cache_clear()
    yield park_id
    load_grid_geometry.cache_clear()


def test_load_grid_geometry_returns_one_cell_per_feature(grid_2x2):
    cells = load_grid_geometry(grid_2x2)
    assert len(cells) == 4
    assert {c["cell_id"] for c in cells} == {
        "cell-1",
        "cell-2",
        "cell-3",
        "cell-4",
    }


def test_load_grid_geometry_preserves_row_and_col(grid_2x2):
    cells = load_grid_geometry(grid_2x2)
    by_id = {c["cell_id"]: c for c in cells}
    assert by_id["cell-1"]["row"] == 0
    assert by_id["cell-1"]["col"] == 0
    assert by_id["cell-2"]["col"] == 1
    assert by_id["cell-3"]["row"] == 1


def test_load_grid_geometry_reprojects_corners_to_wgs84(grid_2x2):
    cells = load_grid_geometry(grid_2x2)
    cell_1 = next(c for c in cells if c["cell_id"] == "cell-1")

    to_wgs84 = Transformer.from_crs(
        f"EPSG:{_EPSG}",
        "EPSG:4326",
        always_xy=True,
    )
    expected_top_left = to_wgs84.transform(_BASE_LEFT, _BASE_TOP)

    assert len(cell_1["corners"]) == 5
    assert cell_1["corners"][0][0] == pytest.approx(expected_top_left[0])
    assert cell_1["corners"][0][1] == pytest.approx(expected_top_left[1])
    assert cell_1["corners"][0] == cell_1["corners"][-1]


def test_load_grid_geometry_unknown_park_id_raises_value_error():
    with pytest.raises(ValueError, match="unknown-park"):
        load_grid_geometry("unknown-park")


def test_load_grid_geometry_is_cached_across_calls(grid_2x2):
    first = load_grid_geometry(grid_2x2)
    second = load_grid_geometry(grid_2x2)
    assert first is second


def test_klaserie_grid_geometry_loads_all_cells():
    cells = load_grid_geometry("klaserie")
    assert len(cells) == 684


def test_klaserie_grid_geometry_corners_within_park_bounds():
    cells = load_grid_geometry("klaserie")
    for cell in cells:
        for lon, lat in cell["corners"]:
            assert 31.0 < lon < 31.4
            assert -24.4 < lat < -24.0


def test_invalidate_cache_invalidates_the_cache(grid_2x2):
    invalidate_grid_cache()

    assert load_grid_geometry.cache_info().currsize == 0

    load_grid_geometry(grid_2x2)
    assert load_grid_geometry.cache_info().currsize == 1

    invalidate_grid_cache()
    assert load_grid_geometry.cache_info().currsize == 0
