from unittest.mock import patch

from app.services.risk_service import get_park_grid


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
        response = get_park_grid("klaserie")

    assert response.type == "FeatureCollection"
    assert len(response.features) == 1
    assert response.features[0].properties.cell_id == "cell-1"
    assert response.features[0].properties.row == 0
    assert response.features[0].geometry.coordinates == [
        fake_cells[0]["corners"],
    ]
