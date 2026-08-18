import json
from functools import lru_cache
from pathlib import Path

from pyproj import Transformer

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# hardcoded for now
_PARK_GRID_FILES = {
    "klaserie": _DATA_DIR / "reserve-grid.geojson",
    "reserve": _DATA_DIR / "reserve-grid.geojson",
}


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
