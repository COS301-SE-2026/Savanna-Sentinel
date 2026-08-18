from app.models.patrol_route import (
    GeographyLineString,
    GeographyPoint,
    PatrolRoute,
)


def test_patrol_route_table_and_column_types():
    assert PatrolRoute.__tablename__ == "patrol_routes"
    column_names = {c.name for c in PatrolRoute.__table__.columns}
    assert column_names == {
        "id",
        "request_id",
        "requested_by",
        "start_point",
        "end_point",
        "max_time",
        "max_fuel",
        "suggested_path",
        "estimated_time",
        "estimated_fuel",
        "risk_coverage",
        "risk_heatmap",
        "created_at",
    }
    assert GeographyPoint().get_col_spec() == "GEOGRAPHY(Point, 4326)"
    assert (
        GeographyLineString().get_col_spec() == "GEOGRAPHY(LineString, 4326)"
    )
