import json

import pytest

from app.workers.terrain.grid import load_projected_cells


def _write_grid(path, features):
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "crs": {
                    "type": "name",
                    "properties": {"name": "urn:ogc:def:crs:EPSG::32736"},
                },
                "features": features,
            },
        ),
    )


def _cell(cell_id, left, bottom):
    return {
        "type": "Feature",
        "properties": {
            "id": cell_id,
            "left": left,
            "right": left + 1000.0,
            "bottom": bottom,
            "top": bottom + 1000.0,
            "row_index": 0,
            "col_index": 0,
        },
        "geometry": None,
    }


def test_cells_come_back_as_refs_with_projected_polygons(tmp_path):
    grid = tmp_path / "grid.geojson"
    _write_grid(
        grid,
        [
            _cell(710.0, 300000.0, 7300000.0),
            _cell("cell-711", 301000.0, 7300000.0),
        ],
    )

    cells, epsg = load_projected_cells(grid)

    assert epsg == 32736
    assert [ref for ref, _ in cells] == ["cell-710", "cell-711"]
    assert cells[0][1].bounds == (300000.0, 7300000.0, 301000.0, 7301000.0)
    assert cells[0][1].area == pytest.approx(1_000_000.0)


def test_a_missing_grid_file_raises_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_projected_cells(tmp_path / "missing.geojson")
