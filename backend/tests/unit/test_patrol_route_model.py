from app.models.patrol_route import (
    GeographyLineString,
    GeographyMultiPoint,
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
        "waypoints",
        "suggested_path",
        "distance_km",
        "risk_coverage",
        "risk_heatmap",
        "created_at",
    }
    assert GeographyPoint().get_col_spec() == "GEOGRAPHY(Point, 4326)"
    assert (
        GeographyMultiPoint().get_col_spec() == "GEOGRAPHY(MultiPoint, 4326)"
    )
    assert (
        GeographyLineString().get_col_spec() == "GEOGRAPHY(LineString, 4326)"
    )


def test_patrol_route_waypoints_are_optional():
    assert PatrolRoute.__table__.columns["waypoints"].nullable is True
