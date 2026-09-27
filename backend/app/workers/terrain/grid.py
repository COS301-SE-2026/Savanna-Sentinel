from __future__ import annotations

import json
from typing import TYPE_CHECKING

from shapely.geometry import box

from app.repositories.risk_repository import GRID_FILE_PATH

if TYPE_CHECKING:
    from pathlib import Path

    from shapely.geometry import Polygon


def load_projected_cells(
    path: Path = GRID_FILE_PATH,
) -> tuple[list[tuple[str, Polygon]], int]:
    if not path.is_file():
        raise FileNotFoundError("No park grid has been uploaded yet")

    with open(path) as f:
        geojson = json.load(f)

    epsg = int(geojson["crs"]["properties"]["name"].rsplit(":", 1)[-1])
    cells = []
    for feature in geojson["features"]:
        props = feature["properties"]
        raw_id = str(props["id"]).replace("cell-", "")
        cells.append(
            (
                f"cell-{int(float(raw_id))}",
                box(
                    props["left"],
                    props["bottom"],
                    props["right"],
                    props["top"],
                ),
            ),
        )
    return cells, epsg
